/**
 * Host half of the dsh-vision-window plugin (v1.2).
 *
 * Web-only surface (when `connection` exists):
 * - `save`: writes a pasted image into `<cwd>/pasted_images/` (loopback only).
 * - `get-config` / `set-config` / `test-vision`: config surface for the client.
 * - `set-credential` / `unset-credential` / `credential-info`: DSH credential
 *   management (names only over the wire, values never come back).
 *
 * Every profile (web + headless):
 * - Settings namespace `vision-window` (ctx.settings) holding provider chain,
 *   cache / downscale / stripThink / timeout options — secrets stay out of it.
 * - A `vision` TOOL (ctx.tools) recognizes an image path through the configured
 *   provider chain: primary preset + ordered fallbacks with classified errors,
 *   in-memory LRU answer cache, optional sharp downscale and think stripping.
 * - A runtime SKILL (ctx.skills) teaches the main model when to call `vision`
 *   and to organize results into an `已识别图片` folder with markdown notes.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import z from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { extOf, MIME, sha256Prefix, downscaleImage, jpegForVision } from './image-utils.js';
import { registerLocalTools } from './local-tools.js';

export { downscaleImage, jpegForVision } from './image-utils.js';

const CHANNEL = '/paste-image';
const MAX_BYTES = 20 * 1024 * 1024; // 20 MiB
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_PIXELS = 4_000_000;
const DEFAULT_CACHE_TTL_SECONDS = 3600;
const DEFAULT_CACHE_MAX_ENTRIES = 200;
const SETTINGS_NS = 'vision-window';
const LEGACY_CREDENTIAL = 'VISION_WINDOW_API_KEY';
const FALLBACK_NOTE_PREFIX = '[vision-window 状态]';

// ── provider presets ─────────────────────────────────────────────────────────
const PRESET_IDS = ['opencode-go', 'opencode-zen', 'xiaomi-mimo', 'custom'];

const PRESET_DEFS = {
  'opencode-go': {
    label: { zh: 'OpenCode Go · MiMo-V2.5', en: 'OpenCode Go · MiMo-V2.5' },
    baseUrl: 'https://opencode.ai/zen/go/v1',
    model: 'mimo-v2.5',
    apiType: 'chat',
    credential: 'OPENCODE_API_KEY',
    maxTokens: 0,
    builtin: true,
  },
  'opencode-zen': {
    label: { zh: 'OpenCode Zen · MiMo-V2.5-Free（免费）', en: 'OpenCode Zen · MiMo-V2.5-Free (free)' },
    baseUrl: 'https://opencode.ai/zen/v1',
    model: 'mimo-v2.5-free',
    apiType: 'chat',
    credential: 'OPENCODE_API_KEY',
    maxTokens: 0,
    builtin: true,
  },
  'xiaomi-mimo': {
    label: { zh: '小米 MiMo · MiMo-V2.5', en: 'Xiaomi MiMo · MiMo-V2.5' },
    baseUrl: 'https://api.xiaomimimo.com/v1',
    model: 'mimo-v2.5',
    apiType: 'chat',
    credential: 'XIAOMI_API_KEY',
    maxTokens: 0,
    builtin: true,
  },
};

// ── settings schema ──────────────────────────────────────────────────────────
const API_TYPES = ['chat', 'responses', 'completions'];
const LANGUAGES = ['zh', 'en'];

const ProviderSchema = z.object({
  baseUrl: z.string().default(''),
  model: z.string().default(''),
  apiType: z.union(API_TYPES.map((v) => z.const(v))).default('chat'),
  credential: z.string().default(''),
  maxTokens: z.number().step(1).min(0).default(0),
});

export const Config = z.object({
  language: z.union(LANGUAGES.map((v) => z.const(v))).default('zh'),
  preset: z.union(PRESET_IDS.map((v) => z.const(v))).default('opencode-go'),
  fallbacks: z.array(z.union(PRESET_IDS.map((v) => z.const(v)))).default(['opencode-zen', 'xiaomi-mimo']),
  custom: ProviderSchema.default({}),
  downscale: z.boolean().default(true),
  downscaleMaxPixels: z.number().step(1).min(1000).default(DEFAULT_MAX_PIXELS),
  cache: z.boolean().default(true),
  cacheTtlSeconds: z.number().step(1).min(0).default(DEFAULT_CACHE_TTL_SECONDS),
  cacheMaxEntries: z.number().step(1).min(1).default(DEFAULT_CACHE_MAX_ENTRIES),
  stripThink: z.boolean().default(true),
  timeoutMs: z.number().step(1).min(1000).max(300_000).default(DEFAULT_TIMEOUT_MS),
  localTools: z.boolean().default(true),
  artifactsDir: z.string().default('.dsh-vision-window/artifacts'),
  legacyMigrated: z.boolean().default(false),
});

// ── tiny helpers ─────────────────────────────────────────────────────────────
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const ok = (value) => ({ ok: true, value });
const err = (message) => ({ ok: false, error: { code: 'internal', message: String(message || 'unknown error'), details: {} } });

const configDir = () => join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'paste-image');
const configPath = () => join(configDir(), 'config.json');

// ── bilingual messages: [zh, en] ─────────────────────────────────────────────
const MSG = {
  missingBaseUrl: ['缺少接口地址（baseURL）', 'Missing base URL'],
  missingModel: ['缺少模型名（model）', 'Missing model name'],
  missingKey: ['缺少密钥（API key）', 'Missing API key'],
  badKey: ['API key 只能包含可打印 ASCII 字符（不含空格）', 'API key must be printable ASCII (no spaces)'],
  badCredentialName: ['凭据名必须以字母/下划线开头，且只含字母数字下划线', 'Credential name must start with a letter/underscore and contain only letters, digits and underscores'],
  noConfig: ['尚未配置识图模型：请在图片存储框的 ⚙ 里选择模型预设并保存', 'Vision model not configured — pick a preset in ⚙ and save'],
  corrupt: ['配置文件损坏，请重新保存配置', 'Config file is corrupt — please save the config again'],
  completionsNoImage: ['Completions 接口不支持图片输入，请在配置里改用 chat 或 responses', 'The Completions API does not accept images — switch to chat or responses'],
  tooMany: ['一次最多识别 {n} 张图片', 'At most {n} images per request'],
  badPath: ['图片路径必须为绝对路径', 'Image paths must be absolute'],
  emptyImage: ['图片为空', 'Image is empty'],
  tooLarge: ['图片超过 20 MiB 上限', 'Image exceeds the 20 MiB limit'],
  badFormat: ['不支持的图片格式（仅 png/jpg/webp/gif）', 'Unsupported image format (png/jpg/webp/gif only)'],
  httpError: ['模型接口返回 HTTP {status}{hint}：{detail}', 'Model API returned HTTP {status}{hint}: {detail}'],
  hintAuth: ['（密钥错误或无权限）', ' (bad API key or no permission)'],
  hintQuota: ['（额度不足）', ' (insufficient quota)'],
  hintRate: ['（触发限流）', ' (rate limited)'],
  hintUrl: ['（接口地址或接口类型不对）', ' (wrong base URL or API type)'],
  nonJson: ['模型接口返回了非 JSON 内容', 'Model API returned non-JSON content'],
  emptyResponse: ['模型返回了空内容（可能只回了推理块）', 'Model returned empty content (maybe only a reasoning block)'],
  timeout: ['请求超时（{s}s）', 'Request timed out ({s}s)'],
  network: ['网络请求失败：{detail}', 'Network request failed: {detail}'],
  credentialMissing: ['凭据 {ref} 未配置（写入 ~/.dsh/.credentials.yaml 或环境变量，并在 ⚙ 里保存后生效）', 'Credential {ref} is not configured (add it to ~/.dsh/.credentials.yaml or the environment, then save in ⚙)'],
  allProvidersFailed: ['识别失败（已尝试 {n} 家供应商）', 'Recognition failed ({n} providers tried)'],
  fallbackNote: ['主供应商 {from} 失败（{reason}），已自动降级到 {to} 识别成功', 'Primary provider {from} failed ({reason}); automatically fell back to {to}'],
  fallbackNoteMany: ['前 {n} 家供应商失败，已自动降级到 {to} 识别成功', 'The first {n} providers failed; automatically fell back to {to}'],
  suggestCredential: ['请检查对应凭据是否已配置且未过期', 'Check that the matching credential is configured and not expired'],
  suggestEndpoint: ['请核对 baseURL、接口类型与模型名', 'Check base URL, API type and model name'],
  suggestQuota: ['请充值/换额度，或换一个供应商', 'Top up or switch to another provider'],
  suggestRate: ['限流，稍后重试或加一个备用供应商', 'Rate limited — retry later or add a fallback provider'],
  suggestNetwork: ['检查网络/代理，或换一个供应商', 'Check network/proxy, or switch providers'],
  connected: ['连接成功', 'Connected'],
  settingSaved: ['已保存', 'Saved'],
  credentialSaved: ['凭据已写入 DSH 凭据库', 'Credential written to the DSH credential store'],
  credentialCleared: ['凭据已清除', 'Credential cleared'],
  customProvider: ['自定义', 'Custom'],
};

function t(lang, key, vars) {
  const entry = MSG[key];
  let s = entry ? (lang === 'en' ? entry[1] : entry[0]) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

// ── legacy config (v1.0 fallback / migration source) ────────────────────────
function defaultLegacy() {
  return { baseUrl: '', model: '', apiKey: '', apiType: 'chat', maxTokens: 0, language: 'zh' };
}

async function loadLegacyConfig() {
  try {
    const raw = await readFile(configPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const c = defaultLegacy();
    if (typeof parsed.baseUrl === 'string') c.baseUrl = parsed.baseUrl.trim();
    if (typeof parsed.model === 'string') c.model = parsed.model.trim();
    if (typeof parsed.apiKey === 'string') c.apiKey = parsed.apiKey.trim();
    if (API_TYPES.includes(parsed.apiType)) c.apiType = parsed.apiType;
    if (Number.isInteger(parsed.maxTokens) && parsed.maxTokens >= 0) c.maxTokens = parsed.maxTokens;
    if (LANGUAGES.includes(parsed.language)) c.language = parsed.language;
    if (!c.baseUrl && !c.model && !c.apiKey) return null;
    return c;
  } catch {
    return null;
  }
}

// ── cache ────────────────────────────────────────────────────────────────────
function createCache(maxEntries, ttlMs) {
  const entries = new Map();
  return {
    maxEntries,
    ttlMs,
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        entries.delete(key);
        return undefined;
      }
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      if (entries.has(key)) entries.delete(key);
      entries.set(key, { value, expiresAt: ttlMs <= 0 ? Infinity : Date.now() + ttlMs });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        entries.delete(oldest);
      }
    },
    clear() {
      entries.clear();
    },
  };
}

// ── think stripping ──────────────────────────────────────────────────────────
export function stripThinking(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw;
  // HTML-escaped tags: &lt;think&gt; … &lt;/think&gt;
  s = s.replace(/&lt;(\/?\s*(?:think|thinking|reasoning)\s*)&gt;/gi, '<$1>');
  // DeepSeek-style special tokens <|think|> … <|/think|> (pipe required; plain
  // <think> tags are handled by the paired-block pass below).
  s = s.replace(/<\|(\s*\/?\s*)(?:think|thinking|reasoning)\s*\|>/gi, '');

  // Remove paired blocks repeatedly (nested/repeated blocks).
  for (let i = 0; i < 8; i++) {
    const before = s;
    s = s.replace(/<\s*(think|thinking|reasoning)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, '');
    if (s === before) break;
  }
  // Unclosed opening tag: drop everything from it to the end.
  s = s.replace(/<\s*(think|thinking|reasoning)\s*>[\s\S]*$/gi, '');
  // Stray closing/delimiter markers.
  s = s.replace(/<\s*\/\s*(think|thinking|reasoning)\s*>/gi, '');
  s = s.replace(/\s*<\s*(think|thinking|reasoning)\s*>\s*/gi, ' ');
  s = s.trim();
  return s;
}

// ── provider resolution ──────────────────────────────────────────────────────
function providerLabel(def, lang) {
  return (def.label && (def.label[lang] || def.label.zh)) || def.label?.zh || def.model || 'provider';
}

function providerFor(config, id) {
  if (id === 'custom') {
    const c = (config && config.custom) || {};
    return {
      id,
      label: t(config?.language || 'zh', 'customProvider'),
      baseUrl: typeof c.baseUrl === 'string' ? c.baseUrl.trim() : '',
      model: typeof c.model === 'string' ? c.model.trim() : '',
      apiType: API_TYPES.includes(c.apiType) ? c.apiType : 'chat',
      credential: typeof c.credential === 'string' ? c.credential.trim() : '',
      maxTokens: Number.isInteger(c.maxTokens) && c.maxTokens >= 0 ? c.maxTokens : 0,
      builtin: false,
    };
  }
  const def = PRESET_DEFS[id];
  if (!def) return null;
  return { id, ...def, label: providerLabel(def, config?.language || 'zh') };
}

export function resolveChain(config) {
  const ids = [config?.preset, ...(config?.fallbacks || [])].filter((x) => typeof x === 'string');
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const p = providerFor(config, id);
    if (!p) continue;
    if (!p.baseUrl || !p.model) continue; // skip empty custom entries
    seen.add(id);
    out.push(p);
  }
  return out;
}

function presetList(lang) {
  const builtins = PRESET_IDS.filter((id) => PRESET_DEFS[id]).map((id) => {
    const d = PRESET_DEFS[id];
    return { id, label: providerLabel(d, lang), baseUrl: d.baseUrl, model: d.model, apiType: d.apiType, credential: d.credential, maxTokens: d.maxTokens, builtin: true };
  });
  builtins.push({ id: 'custom', label: t(lang, 'customProvider'), baseUrl: '', model: '', apiType: 'chat', credential: '', maxTokens: 0, builtin: false });
  return builtins;
}

// ── credentials ──────────────────────────────────────────────────────────────
async function resolveCredential(ctx, ref) {
  const name = String(ref || '').trim();
  if (name === '') return undefined;
  const credentials = ctx.get('credentials');
  if (credentials && typeof credentials.resolve === 'function') {
    try {
      return await credentials.resolve(name);
    } catch {
      /* fall through */
    }
  }
  const env = process.env[name];
  if (env) return { value: env, source: 'process-env' };
  return undefined;
}

async function describeCredential(ctx, ref) {
  const name = String(ref || '').trim();
  if (name === '') return { ref: name, configured: false, writable: false };
  const credentials = ctx.get('credentials');
  if (credentials && typeof credentials.describe === 'function') {
    try {
      const info = await credentials.describe(name);
      return { ref: name, configured: !!info?.configured, source: info?.source, writable: !!info?.writable };
    } catch {
      /* fall through */
    }
  }
  return { ref: name, configured: Boolean(process.env[name]), source: process.env[name] ? 'process-env' : undefined, writable: false };
}

function isCredentialName(raw) {
  return typeof raw === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(raw.trim());
}

function normalizeKey(raw) {
  if (typeof raw !== 'string') return '';
  const v = raw.trim();
  if (v.length === 0) return '';
  if (!/^[\x21-\x7E]+$/.test(v)) return null;
  return v;
}

// ── requests / responses ─────────────────────────────────────────────────────
function visionPrompt(lang) {
  if (lang === 'en') {
    return `Please recognize the following image(s) — if there are several, describe each in order.

Requirements:
1. For each image, first state its type/scene in one sentence, then describe the main content by region: transcribe text verbatim, and note elements, layout, colors, UI structure, chart data, etc.;
2. Transcribe text exactly; mark anything unclear or uncertain as "uncertain" and do not fabricate;
3. Finally, list any structurally extractable information (tables, lists, code, error messages, etc.);
4. Output only an objective description and analysis of the image content; do not perform other tasks. Answer in English.`;
  }
  return `请识别以下图片（可能多张，请按顺序分别描述）：
要求：
1. 每张图片先一句话说明类型/场景，再按区域描述主要内容——文字逐字转写、元素、布局、颜色、界面结构、图表数据等；
2. 文字内容逐字准确，看不清或不确定的地方明确标注「不确定」，禁止编造；
3. 最后列出可结构化提取的信息（表格、清单、代码、报错信息等）；
4. 只输出图片内容的客观描述与分析，不执行其他任务；用中文回答。`;
}

function buildPrompt(lang, question) {
  const base = visionPrompt(lang);
  const q = question && typeof question === 'string' ? question.trim() : '';
  return q.length > 0 ? `${base}\n\n用户的问题是：${q}` : base;
}

function joinUrl(base, path) {
  return `${String(base).trim().replace(/\/+$/, '')}/${path}`;
}

function chatBody(provider, urls, prompt) {
  const content = [{ type: 'text', text: prompt }]
    .concat(urls.map((u) => ({ type: 'image_url', image_url: { url: u } })));
  const body = { model: provider.model, messages: [{ role: 'user', content }] };
  if (provider.maxTokens > 0) body.max_tokens = provider.maxTokens;
  return { url: joinUrl(provider.baseUrl, 'chat/completions'), body };
}

function responsesBody(provider, urls, prompt) {
  const content = [{ type: 'input_text', text: prompt }]
    .concat(urls.map((u) => ({ type: 'input_image', image_url: u })));
  const body = { model: provider.model, input: [{ role: 'user', content }] };
  if (provider.maxTokens > 0) body.max_output_tokens = provider.maxTokens;
  return { url: joinUrl(provider.baseUrl, 'responses'), body };
}

function testBody(provider) {
  if (provider.apiType === 'responses') {
    return { url: joinUrl(provider.baseUrl, 'responses'), body: { model: provider.model, input: [{ role: 'user', content: [{ type: 'input_text', text: 'ping' }] }], max_output_tokens: 1 } };
  }
  if (provider.apiType === 'completions') {
    return { url: joinUrl(provider.baseUrl, 'completions'), body: { model: provider.model, prompt: 'ping', max_tokens: 1 } };
  }
  return { url: joinUrl(provider.baseUrl, 'chat/completions'), body: { model: provider.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 } };
}

function visionRequest(provider, urls, prompt, lang = 'zh') {
  if (provider.apiType === 'responses') return responsesBody(provider, urls, prompt);
  if (provider.apiType === 'completions') throw new ProviderFailure('endpoint', t(lang, 'completionsNoImage'), 405);
  return chatBody(provider, urls, prompt);
}

function textFromChat(data) {
  const c = data && data.choices && data.choices[0];
  return c && c.message && typeof c.message.content === 'string' ? c.message.content : '';
}

function textFromResponses(data) {
  if (data && typeof data.output_text === 'string' && data.output_text) return data.output_text;
  const parts = [];
  const walk = (items) => {
    if (!Array.isArray(items)) return;
    for (const it of items) {
      if (!it || typeof it !== 'object') continue;
      if (it.type === 'output_text' && typeof it.text === 'string') parts.push(it.text);
      if (it.type === 'message' && Array.isArray(it.content)) walk(it.content);
    }
  };
  walk(data && data.output);
  return parts.join('');
}

function textFromCompletions(data) {
  const c = data && data.choices && data.choices[0];
  return c && typeof c.text === 'string' ? c.text : '';
}

function extractText(data, apiType, stripThink) {
  const raw = apiType === 'responses' ? textFromResponses(data) : apiType === 'completions' ? textFromCompletions(data) : textFromChat(data);
  const text = stripThink ? stripThinking(raw) : String(raw || '').trim();
  return text;
}

// ── classified provider failures ─────────────────────────────────────────────
class ProviderFailure extends Error {
  constructor(code, message, status, retryAfter) {
    super(message);
    this.name = 'ProviderFailure';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function classifyHttpStatus(lang, status, detail) {
  const hint = status === 401 || status === 403
    ? t(lang, 'hintAuth')
    : status === 402
      ? t(lang, 'hintQuota')
      : status === 429
        ? t(lang, 'hintRate')
        : status === 404 || status === 405
          ? t(lang, 'hintUrl')
          : '';
  const code = status === 401 || status === 403 ? 'auth'
    : status === 402 ? 'quota'
      : status === 429 ? 'rate'
        : status === 404 || status === 405 ? 'endpoint'
          : 'server';
  return new ProviderFailure(code, t(lang, 'httpError', { status, hint, detail }), status);
}

async function fetchOnce(req, headers, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(req.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** POST one provider request; 429 retries once respecting Retry-After (≤5s). */
async function callProvider(ctx, provider, req, options) {
  const lang = options.lang;
  const key = await resolveCredential(ctx, provider.credential);
  if (provider.credential && !key?.value) {
    throw new ProviderFailure('credential-missing', t(lang, 'credentialMissing', { ref: provider.credential }));
  }
  const headers = { 'Content-Type': 'application/json' };
  if (key?.value) headers.Authorization = `Bearer ${key.value}`;

  let attempt = 0;
  for (;;) {
    let res;
    try {
      res = await fetchOnce(req, headers, options.timeoutMs);
    } catch (e) {
      if (e && e.name === 'AbortError') throw new ProviderFailure('timeout', t(lang, 'timeout', { s: options.timeoutMs / 1000 }));
      throw new ProviderFailure('network', t(lang, 'network', { detail: String((e && e.message) || e).slice(0, 300) }));
    }
    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      let detail = raw;
      try {
        const j = JSON.parse(raw);
        if (j && j.error && j.error.message) detail = j.error.message;
      } catch { /* keep raw */ }
      if (detail.length > 400) detail = `${detail.slice(0, 400)}…`;
      const failure = classifyHttpStatus(lang, res.status, detail);
      const retryAfterHeader = res.headers.get('retry-after');
      const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : NaN;
      if (failure.code === 'rate' && attempt === 0 && Number.isFinite(retryAfter) && retryAfter > 0) {
        await sleep(Math.min(Math.max(retryAfter, 1), 5) * 1000);
        attempt++;
        continue;
      }
      throw failure;
    }
    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new ProviderFailure('bad-response', t(lang, 'nonJson'));
    }
    const text = extractText(data, provider.apiType, options.stripThink);
    if (!text) throw new ProviderFailure('bad-response', t(lang, 'emptyResponse'));
    return text;
  }
}

function suggestionFor(code, lang) {
  if (code === 'credential-missing' || code === 'auth') return t(lang, 'suggestCredential');
  if (code === 'quota') return t(lang, 'suggestQuota');
  if (code === 'rate') return t(lang, 'suggestRate');
  if (code === 'endpoint') return t(lang, 'suggestEndpoint');
  return t(lang, 'suggestNetwork');
}

function aggregateFailure(lang, attempts) {
  const lines = attempts.map((a) => `- ${a.label}：${a.message}`);
  const seen = new Set();
  const suggestions = attempts.map((a) => suggestionFor(a.code, lang)).filter((s) => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });
  const prefix = lang === 'en' ? 'Hints: ' : '建议：';
  return `${t(lang, 'allProvidersFailed', { n: attempts.length })}\n${lines.join('\n')}\n${prefix}${suggestions.join('；')}`;
}

// ── read image bytes → data URL ──────────────────────────────────────────────
async function readImageData(path, config, lang) {
  const buf = await readFile(path);
  if (buf.length === 0) throw new Error(t(lang, 'emptyImage'));
  if (buf.length > MAX_BYTES) throw new Error(t(lang, 'tooLarge'));
  const ext = extOf(buf);
  if (ext === null) throw new Error(t(lang, 'badFormat'));
  const fingerprint = sha256Prefix(buf);
  let bytes = buf;
  if (config.downscale !== false) {
    const maxPixels = Number.isFinite(config.downscaleMaxPixels) && config.downscaleMaxPixels > 0 ? config.downscaleMaxPixels : DEFAULT_MAX_PIXELS;
    bytes = await downscaleImage(buf, maxPixels);
  }
  // Vision uploads are JPEG-first: keep the wire payload small regardless of
  // whether downscale actually resized the image. Local tools never use this.
  bytes = await jpegForVision(bytes);
  const outExt = extOf(bytes) || ext;
  return {
    dataUrl: `data:${MIME[outExt] || MIME[ext]};base64,${bytes.toString('base64')}`,
    fingerprint,
  };
}

// ── the recognition pipeline ─────────────────────────────────────────────────
function cacheKeyFor(config, chain, fingerprint, question) {
  const sig = chain.map((p) => `${p.id}:${p.model}@${p.baseUrl}`).join('>');
  const q = question && typeof question === 'string' ? question.trim() : '';
  return `${sig}|${fingerprint}|${config.language}|${config.stripThink ? 't' : 'r'}|${q}`;
}

function ensureCache(config, state) {
  const maxEntries = Number.isFinite(config.cacheMaxEntries) && config.cacheMaxEntries >= 1 ? config.cacheMaxEntries : DEFAULT_CACHE_MAX_ENTRIES;
  const ttlMs = (Number.isFinite(config.cacheTtlSeconds) ? config.cacheTtlSeconds : DEFAULT_CACHE_TTL_SECONDS) * 1000;
  if (!state.cache || state.cache.maxEntries !== maxEntries || state.cache.ttlMs !== ttlMs) {
    state.cache = createCache(maxEntries, ttlMs);
  }
  return state.cache;
}

async function recognizeWithFallback(ctx, state, config, path, question) {
  const lang = config.language;
  if (typeof path !== 'string' || !isAbsolute(path)) throw new Error(t(lang, 'badPath'));
  const chain = resolveChain(config);
  if (chain.length === 0) throw new Error(t(lang, 'noConfig'));

  const image = await readImageData(path, config, lang);
  const prompt = buildPrompt(lang, question);

  if (config.cache !== false) {
    const cache = ensureCache(config, state);
    const key = cacheKeyFor(config, chain, image.fingerprint, question);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
  }

  const attempts = [];
  for (const provider of chain) {
    try {
      const req = visionRequest(provider, [image.dataUrl], prompt, lang);
      let text = await callProvider(ctx, provider, req, {
        lang,
        timeoutMs: Number.isFinite(config.timeoutMs) ? config.timeoutMs : DEFAULT_TIMEOUT_MS,
        stripThink: config.stripThink !== false,
      });
      if (attempts.length === 1) {
        text = `${text}\n\n${FALLBACK_NOTE_PREFIX} ${t(lang, 'fallbackNote', { from: attempts[0].label, reason: attempts[0].message, to: provider.label })}`;
      } else if (attempts.length > 1) {
        text = `${text}\n\n${FALLBACK_NOTE_PREFIX} ${t(lang, 'fallbackNoteMany', { n: attempts.length, to: provider.label })}`;
      }
      if (config.cache !== false) {
        const cache = ensureCache(config, state);
        cache.set(cacheKeyFor(config, chain, image.fingerprint, question), text);
      }
      return text;
    } catch (e) {
      attempts.push({ id: provider.id, label: provider.label, code: e?.code || 'internal', message: String(e?.message || e) });
    }
  }
  throw new Error(aggregateFailure(lang, attempts));
}

// ── runtime skill ────────────────────────────────────────────────────────────
const SKILL_NAME = 'vision-fallback';
const SKILL_DESCRIPTION = '主模型无法识别图片内容时使用（纯文本模型、粘贴图片发送失败、识别模糊或失败、需要精确读出截图/图表/UI 界面/报错/扫描件内容）。用 vision 工具识别图片路径，并把结果整理到工作区的「已识别图片」文件夹（配 markdown 描述）。';
const SKILL_CONTENT = `# dsh-vision-window 识图

## 触发条件（满足任意一条即使用）

- 用户要求「看/识别/分析/描述/还原」某张图片、截图、图表、UI 界面、设计稿、报错截图、扫描件；
- 用户给了图片文件路径（.png / .jpg / .jpeg / .webp / .gif）；
- 用户粘贴了图片附件，或发令「识别工作区里的图片」等批量识图；
- 你是纯文本模型无法直接读图，或 read_image 报错 / 识别失败 / 内容模糊，需要逐字逐格的精确细节。

## 识图方法

用 vision 工具识图，一次传一张图的路径：

vision(image_path="<图片绝对路径>", question="<用户的问题，可选>")

- 插件会自动在主供应商失败时按顺序降级到备用供应商；识别成功即返回结果。
- 若结果末尾出现以「[vision-window 状态]」开头的行，那是插件写的降级说明，写 markdown 时**不要把该行写进描述**。

## 本地像素 / OCR 工具（零配置，用户什么都没填也能用）

以下工具不依赖任何识图模型配置，只要拿到图片路径就直接调用：

- vw_crop(image, region="x1,y1,x2,y2")：按像素框裁剪，保存 PNG。
- vw_pixel_diff(original, rebuilt, threshold?)：逐像素对比 → 差异率 + 最差 8×8 网格 + 热力图 PNG + JSON 报告。
- vw_colors(image, top?)：提取主色（hex + 占比）。
- vw_trace(image, steps?)：位图转 SVG（图标/logo）。
- vw_ocr(image, lang?)：本地 tesseract 转写文字（默认 chi_sim+eng）；未安装 tesseract 时工具会返回安装指引。
- vw_html_screenshot(source, width?, height?)：用系统 Chrome/Edge 给本地 HTML 截图。
- vw_extract_foreground(image, tolerance?)：纯色背景抠图，返回透明 PNG。

选择原则：需要"理解/描述/定位图片内容"用 vision（需要用户已配置供应商）；需要"裁剪、逐像素比较、取色、矢量化、OCR、HTML 截图、抠图"优先用 vw_*（零配置、结果可验证）。两类工具可以组合：例如先用 vw_pixel_diff 测 UI 还原差异，再对差异最大的区域 vw_crop 放大后交给 vision 细看。

## 识别成功后：整理到「已识别图片」文件夹

识别完成后，在工作区创建「已识别图片」文件夹，并把结果写成 markdown：

- 描述文件：已识别图片\\NN_主题词.md（NN 为两位序号；主题词 2~10 字，只含中英文与数字，不要标点；重名则加 _2、_3…）；
- md 第一行固定记录「原图片路径」；
- 之后写完整描述（vision 返回的文字，去掉 [vision-window 状态] 行）；描述里标注「不确定」的部分如实保留；
- 图片移动规则：只有图片路径位于「pasted_images」文件夹（即通过图片存储框粘贴、由插件保存到工作区的图片）才把图片移入「已识别图片」；其他任何位置的图片（项目素材、立绘、图标、边框、皮肤素材、依赖包内图片等）一律保留原位，只写 md。

## 禁止

- 禁止说「我看不到图片」就结束任务——能理解内容用 vision，像素级操作用 vw_* 工具；
- 禁止猜测、编造图片内容；看不清处标注「不确定」；
- 禁止用 read 工具读图片（read 是文本工具，识图走 vision 工具）；
- 禁止移动 / 重命名 / 删除项目素材类图片；
- 批量时禁止把多张图片合并进一次 vision 调用。`;

// ── settings / migration glue ────────────────────────────────────────────────
async function hasUserSettingsSection(ctx) {
  try {
    if (typeof ctx.settings?.describe !== 'function') return false;
    const descriptor = ctx.settings.describe().find((d) => d && d.ns === SETTINGS_NS);
    return descriptor ? descriptor.user !== undefined : false;
  } catch {
    return false;
  }
}

async function migrateLegacyConfig(ctx, scope) {
  try {
    if (await hasUserSettingsSection(ctx)) return;
    const legacy = await loadLegacyConfig();
    if (!legacy || (!legacy.baseUrl && !legacy.model)) return;
    const patch = {
      preset: 'custom',
      fallbacks: [],
      custom: {
        baseUrl: legacy.baseUrl,
        model: legacy.model,
        apiType: legacy.apiType || 'chat',
        credential: '',
        maxTokens: legacy.maxTokens || 0,
      },
      language: legacy.language || 'zh',
      legacyMigrated: true,
    };
    if (legacy.apiKey) {
      const credentials = ctx.get('credentials');
      if (credentials && typeof credentials.set === 'function') {
        try {
          await credentials.set(LEGACY_CREDENTIAL, legacy.apiKey);
          patch.custom.credential = LEGACY_CREDENTIAL;
        } catch (e) {
          ctx.logger?.warn('dsh-vision-window: legacy key migration to DSH credentials failed: %s', String((e && e.message) || e));
        }
      }
    }
    await scope.update(patch);
    ctx.logger?.info('dsh-vision-window: migrated legacy ~/.dsh/paste-image/config.json into the vision-window settings section');
  } catch (e) {
    ctx.logger?.warn('dsh-vision-window: legacy config migration skipped: %s', String((e && e.message) || e));
  }
}

async function readyConfig(state) {
  await state.ready.promise;
  await state.migration;
  if (!state.scope) throw new Error('vision-window settings not ready');
  return state.scope.get();
}

function wireCustom(custom) {
  const c = custom || {};
  return {
    baseUrl: typeof c.baseUrl === 'string' ? c.baseUrl : '',
    model: typeof c.model === 'string' ? c.model : '',
    apiType: API_TYPES.includes(c.apiType) ? c.apiType : 'chat',
    credential: typeof c.credential === 'string' ? c.credential : '',
    maxTokens: Number.isInteger(c.maxTokens) && c.maxTokens >= 0 ? c.maxTokens : 0,
  };
}

async function wireConfig(ctx, config) {
  const chain = resolveChain(config);
  const refs = [...new Set(chain.map((p) => p.credential).filter((r) => r))];
  const credentials = {};
  for (const ref of refs) credentials[ref] = await describeCredential(ctx, ref);
  return {
    language: config.language,
    preset: config.preset,
    fallbacks: [...(config.fallbacks || [])],
    custom: wireCustom(config.custom),
    downscale: config.downscale !== false,
    downscaleMaxPixels: config.downscaleMaxPixels,
    cache: config.cache !== false,
    cacheTtlSeconds: config.cacheTtlSeconds,
    cacheMaxEntries: config.cacheMaxEntries,
    stripThink: config.stripThink !== false,
    timeoutMs: config.timeoutMs,
    localTools: config.localTools !== false,
    artifactsDir: config.artifactsDir,
    presetList: presetList(config.language),
    credentials,
  };
}

function pickDefined(src, keys) {
  const out = {};
  for (const key of keys) {
    if (src && Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

/** Build a settings patch from the wire payload (secrets are never accepted). */
function patchFromWire(payload) {
  const p = payload || {};
  const patch = pickDefined(p, ['language', 'preset', 'fallbacks', 'downscale', 'downscaleMaxPixels', 'cache', 'cacheTtlSeconds', 'cacheMaxEntries', 'stripThink', 'timeoutMs', 'localTools', 'artifactsDir']);
  if (p.custom && typeof p.custom === 'object') {
    patch.custom = pickDefined(p.custom, ['baseUrl', 'model', 'apiType', 'credential', 'maxTokens']);
  }
  return patch;
}

/** Draft config for a connection test: current settings overlaid with wire fields. */
function draftFromWire(base, payload) {
  const patch = patchFromWire(payload);
  const merged = { ...base, ...patch };
  if (patch.custom) merged.custom = { ...wireCustom(base.custom), ...patch.custom };
  return Config(merged);
}

// ── plugin entry ─────────────────────────────────────────────────────────────
export function apply(ctx) {
  const state = {
    scope: null,
    ready: deferred(),
    migration: Promise.resolve(),
    cache: createCache(DEFAULT_CACHE_MAX_ENTRIES, DEFAULT_CACHE_TTL_SECONDS * 1000),
  };

  // Settings + model-facing capabilities: available in BOTH web and headless.
  ctx.inject(['settings'], (sctx) => {
    state.scope = sctx.settings.register(SETTINGS_NS, Config, { applies: 'live' });
    state.ready.resolve(state.scope);
    state.migration = migrateLegacyConfig(sctx, state.scope).catch(() => {});

    // Model-facing `vision` tool: recognize an image path via the provider chain.
    ctx.inject(['tools'], (tscope) => {
      tscope.tools.register(defineTool({
        name: 'vision',
        description: '识别一张图片文件并返回文字描述（走配置好的识图模型，主供应商失败会自动降级到备用供应商）。参数 image_path 为图片绝对路径；可选 question 为关于该图片的具体问题。当主模型是纯文本模型、read_image 不可用或失败、或需要精确读出截图/图表/报错/扫描件内容时使用。',
        parameters: {
          image_path: { type: 'string', required: true, description: '图片文件绝对路径（.png/.jpg/.jpeg/.webp/.gif）' },
          question: { type: 'string', description: '关于该图片的具体问题，可选' },
        },
        output: {
          schema: { type: 'string' },
          render: (_args, value) => [{ type: 'text', text: value }],
        },
        isConcurrencySafe: () => true,
        async execute(args) {
          const config = await readyConfig(state);
          return recognizeWithFallback(tscope, state, config, String(args.image_path || '').trim(), args.question);
        },
        presentCall(args) {
          return { card: 'generic', title: `识别图片 ${args.image_path}`, locations: [{ path: args.image_path }] };
        },
      }));

      // Zero-config local pixel/OCR tools (vw_*). These never touch provider
      // settings or credentials and are available even with nothing configured.
      registerLocalTools(tscope, () => state.scope.get());
    });

    // Runtime skill: when + how to use `vision`, and the 已识别图片 workflow.
    ctx.inject(['skills'], (sscope) => {
      sscope.skills.register({
        name: SKILL_NAME,
        description: SKILL_DESCRIPTION,
        content: SKILL_CONTENT,
        source: 'dsh-vision-window',
      });
    });
  });

  // Web-only surface: loopback RPC for the image box and the config panel.
  // Headless profiles never provide `connection`, so this fiber stays dormant
  // and the plugin still contributes settings + tool + skill there.
  ctx.inject(['connection'], (cctx) => {
    cctx.effect(() => cctx.connection.rpc.handle(CHANNEL, async (endpoint, payload) => {
      const p = payload ?? {};
      try {
        if (endpoint === 'save') {
          if (typeof p.cwd !== 'string' || !isAbsolute(p.cwd)) return err('cwd must be an absolute path');
          if (typeof p.data !== 'string' || p.data.length === 0) return err('missing image data');
          const buf = Buffer.from(p.data, 'base64');
          if (buf.length === 0) return err('empty image data');
          if (buf.length > MAX_BYTES) return err('image exceeds 20 MiB limit');
          const ext = extOf(buf);
          if (ext === null) return err('unsupported image format (png/jpg/webp/gif only)');
          const dir = join(resolve(p.cwd), 'pasted_images');
          await mkdir(dir, { recursive: true });
          // Filename is fully host-generated — never client-controlled.
          const name = `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const target = join(dir, name);
          await writeFile(target, buf, { flag: 'wx' });
          return ok({ path: target });
        }

        if (endpoint === 'get-config') {
          const config = await readyConfig(state);
          return ok(await wireConfig(cctx, config));
        }

        if (endpoint === 'set-config') {
          const patch = patchFromWire(p);
          if (Object.keys(patch).length === 0) return ok(await wireConfig(cctx, state.scope.get()));
          await state.scope.update(patch);
          return ok(await wireConfig(cctx, state.scope.get()));
        }

        if (endpoint === 'test-vision') {
          const base = await readyConfig(state);
          let draft;
          try {
            draft = draftFromWire(base, p);
          } catch (e) {
            return err(String((e && e.message) || e));
          }
          const chain = resolveChain(draft);
          if (chain.length === 0) return err(t(draft.language, 'noConfig'));
          const providers = [];
          let succeeded = false;
          for (const provider of chain) {
            try {
              const req = testBody(provider);
              await callProvider(cctx, provider, req, {
                lang: draft.language,
                timeoutMs: Number.isFinite(draft.timeoutMs) ? draft.timeoutMs : DEFAULT_TIMEOUT_MS,
                stripThink: false,
              });
              providers.push({ id: provider.id, name: provider.label, ok: true });
              succeeded = true;
              break; // chain semantics: first reachable provider wins
            } catch (e) {
              providers.push({ id: provider.id, name: provider.label, ok: false, errorClass: e?.code || 'internal', message: String(e?.message || e) });
            }
          }
          const provider = providers.find((x) => x.ok);
          return ok({
            ok: succeeded,
            message: succeeded ? `${provider.name} ${t(draft.language, 'connected')}` : t(draft.language, 'allProvidersFailed', { n: providers.length }),
            providers,
          });
        }

        if (endpoint === 'set-credential') {
          if (!isCredentialName(p.ref)) return err(t('zh', 'badCredentialName'));
          const value = normalizeKey(p.value);
          if (value === null) return err(t('zh', 'badKey'));
          if (value === '') return err(t('zh', 'missingKey'));
          const credentials = cctx.get('credentials');
          if (!credentials || typeof credentials.set !== 'function') return err('credentials service unavailable');
          try {
            await credentials.set(p.ref.trim(), value);
            return ok({ configured: true });
          } catch (e) {
            return err(`credential store rejected the write (${e?.code || 'internal'}); the reference may be shadowed by a read-only source`);
          }
        }

        if (endpoint === 'unset-credential') {
          if (!isCredentialName(p.ref)) return err(t('zh', 'badCredentialName'));
          const credentials = cctx.get('credentials');
          if (!credentials || typeof credentials.unset !== 'function') return err('credentials service unavailable');
          try {
            await credentials.unset(p.ref.trim());
            return ok({ configured: false });
          } catch (e) {
            return err(`credential store rejected the clear (${e?.code || 'internal'})`);
          }
        }

        if (endpoint === 'credential-info') {
          if (!isCredentialName(p.ref)) return err(t('zh', 'badCredentialName'));
          return ok(await describeCredential(cctx, p.ref.trim()));
        }

        return err(`unknown endpoint "${endpoint}"`);
      } catch (e) {
        return err(String((e && e.message) || e));
      }
    }, { authority: 'loopback' }), 'paste-image: rpc');
  });
}

export const internals = {
  stripThinking,
  resolveChain,
  downscaleImage,
  createCache,
  classifyHttpStatus,
  providerFor,
};
