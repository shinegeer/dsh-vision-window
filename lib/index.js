/**
 * Host half of the dsh-vision-window plugin.
 *
 * - `save`: writes a pasted image into `<cwd>/pasted_images/` (loopback only).
 * - Config store: `<DSH_HOME>/paste-image/config.json` (owner-only) holds the
 *   vision model's baseURL / apiKey / model / apiType / maxTokens / language.
 * - `get-config` / `set-config` / `test-vision`: config surface for the client.
 * - A `vision` TOOL (registered with `ctx.tools`) recognizes an image path via
 *   the configured model, so the main model can call it anywhere (long
 *   projects) — not just through the image box.
 * - A runtime SKILL (registered with `ctx.skills`) teaches the main model when
 *   to call `vision` and to organize results into an `已识别图片` folder with
 *   markdown descriptions.
 *
 * Self-contained: the only external I/O is the user-configured vision endpoint,
 * called with Node's global `fetch` under a hard timeout. No DSH model/session/
 * agent/approval internals are touched.
 */
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join, resolve, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { defineTool } from '@deepseek-ai/dsh-tools';

const CHANNEL = '/paste-image';
const MAX_BYTES = 20 * 1024 * 1024; // 20 MiB
const MAX_IMAGES = 10;
const REQUEST_TIMEOUT_MS = 60_000;
const API_TYPES = ['chat', 'responses', 'completions'];
const LANGUAGES = ['zh', 'en'];
const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

/** Magic-number sniffing: the extension is decided by bytes, never by client input. */
function extOf(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'webp';
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif';
  return null;
}

const ok = (value) => ({ ok: true, value });
const err = (message) => ({ ok: false, error: { code: 'internal', message: String(message || 'unknown error'), details: {} } });

const configDir = () => join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'paste-image');
const configPath = () => join(configDir(), 'config.json');

function defaultConfig() {
  // maxTokens === 0 means "unset": the request omits max_tokens, letting the
  // provider use its own default output cap (the most compatible choice).
  return { baseUrl: '', model: '', apiKey: '', apiType: 'chat', maxTokens: 0, language: 'zh' };
}

function normalizeConfig(parsed) {
  const c = defaultConfig();
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return c;
  if (typeof parsed.baseUrl === 'string') c.baseUrl = parsed.baseUrl.trim();
  if (typeof parsed.model === 'string') c.model = parsed.model.trim();
  if (typeof parsed.apiKey === 'string') c.apiKey = parsed.apiKey;
  if (API_TYPES.includes(parsed.apiType)) c.apiType = parsed.apiType;
  if (Number.isInteger(parsed.maxTokens) && parsed.maxTokens >= 0) c.maxTokens = parsed.maxTokens;
  if (LANGUAGES.includes(parsed.language)) c.language = parsed.language;
  return c;
}

/** Read config; a missing file is "unconfigured", a corrupt file is flagged. */
async function loadConfig() {
  try {
    const raw = await readFile(configPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return { config: normalizeConfig(parsed), corrupt: false };
  } catch (e) {
    if (e && e.code === 'ENOENT') return { config: defaultConfig(), corrupt: false };
    return { config: defaultConfig(), corrupt: true, error: String((e && e.message) || e) };
  }
}

async function persistConfig(config) {
  await mkdir(configDir(), { recursive: true });
  const tmp = `${configPath()}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await writeFile(tmp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, configPath());
}

/** Wire shape: never contains the key itself, only whether one is stored. */
function redact(config) {
  return { baseUrl: config.baseUrl, model: config.model, apiType: config.apiType, maxTokens: config.maxTokens, language: config.language, hasKey: config.apiKey.length > 0 };
}

function isConfigured(config) {
  return config.baseUrl.length > 0 && config.model.length > 0 && config.apiKey.length > 0;
}

/** Trim + printable-ASCII check; returns '' (empty), the key, or null (invalid). */
function normalizeKey(raw) {
  if (typeof raw !== 'string') return '';
  const t = raw.trim();
  if (t.length === 0) return '';
  if (!/^[\x21-\x7E]+$/.test(t)) return null;
  return t;
}

function joinUrl(base, path) {
  return `${String(base).trim().replace(/\/+$/, '')}/${path}`;
}

// ── bilingual messages: [zh, en] ──────────────────────────────────────────────
const MSG = {
  missingBaseUrl: ['缺少接口地址（baseURL）', 'Missing base URL'],
  missingModel: ['缺少模型名（model）', 'Missing model name'],
  missingKey: ['缺少密钥（API key）', 'Missing API key'],
  badKey: ['API key 只能包含可打印 ASCII 字符（不含空格）', 'API key must be printable ASCII (no spaces)'],
  noConfig: ['尚未配置识图模型：请在图片存储框的 ⚙ 里填写地址/密钥/模型名', 'Vision model not configured — click ⚙ in the image box and fill in base URL / API key / model'],
  corrupt: ['配置文件损坏，请重新保存配置', 'Config file is corrupt — please save the config again'],
  completionsNoImage: ['Completions 接口不支持图片输入，请在配置里改用 chat 或 responses', 'The Completions API does not accept images — switch to chat or responses'],
  tooMany: ['一次最多识别 {n} 张图片', 'At most {n} images per request'],
  badPath: ['图片路径必须为绝对路径', 'Image paths must be absolute'],
  emptyImage: ['图片为空', 'Image is empty'],
  tooLarge: ['图片超过 20 MiB 上限', 'Image exceeds the 20 MiB limit'],
  badFormat: ['不支持的图片格式（仅 png/jpg/webp/gif）', 'Unsupported image format (png/jpg/webp/gif only)'],
  httpError: ['模型接口返回 HTTP {status}{hint}：{detail}', 'Model API returned HTTP {status}{hint}: {detail}'],
  hintAuth: ['（密钥错误或无权限）', ' (bad API key or no permission)'],
  hintUrl: ['（接口地址或接口类型不对）', ' (wrong base URL or API type)'],
  nonJson: ['模型接口返回了非 JSON 内容', 'Model API returned non-JSON content'],
  timeout: ['请求超时（{s}s）', 'Request timed out ({s}s)']
};

function t(lang, key, vars) {
  const entry = MSG[key];
  let s = entry ? (lang === 'en' ? entry[1] : entry[0]) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

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

function chatBody(cfg, urls, prompt) {
  const content = [{ type: 'text', text: prompt }]
    .concat(urls.map((u) => ({ type: 'image_url', image_url: { url: u } })));
  const body = { model: cfg.model, messages: [{ role: 'user', content }] };
  if (cfg.maxTokens > 0) body.max_tokens = cfg.maxTokens;
  return { url: joinUrl(cfg.baseUrl, 'chat/completions'), body };
}

function responsesBody(cfg, urls, prompt) {
  const content = [{ type: 'input_text', text: prompt }]
    .concat(urls.map((u) => ({ type: 'input_image', image_url: u })));
  const body = { model: cfg.model, input: [{ role: 'user', content }] };
  if (cfg.maxTokens > 0) body.max_output_tokens = cfg.maxTokens;
  return { url: joinUrl(cfg.baseUrl, 'responses'), body };
}

function testBody(cfg) {
  if (cfg.apiType === 'responses') {
    return { url: joinUrl(cfg.baseUrl, 'responses'), body: { model: cfg.model, input: [{ role: 'user', content: [{ type: 'input_text', text: 'ping' }] }], max_output_tokens: 1 } };
  }
  if (cfg.apiType === 'completions') {
    return { url: joinUrl(cfg.baseUrl, 'completions'), body: { model: cfg.model, prompt: 'ping', max_tokens: 1 } };
  }
  return { url: joinUrl(cfg.baseUrl, 'chat/completions'), body: { model: cfg.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 } };
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

function extractText(data, apiType) {
  if (apiType === 'responses') return textFromResponses(data);
  if (apiType === 'completions') return textFromCompletions(data);
  return textFromChat(data);
}

/** POST the built request; returns ok({ text }) or err(message). */
async function callEndpoint(cfg, req, apiType) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(req.body),
      signal: controller.signal
    });
    const raw = await res.text();
    if (!res.ok) {
      let detail = raw;
      try {
        const j = JSON.parse(raw);
        if (j && j.error && j.error.message) detail = j.error.message;
      } catch {}
      if (detail.length > 400) detail = `${detail.slice(0, 400)}…`;
      const hint = res.status === 401 || res.status === 403
        ? t(cfg.language, 'hintAuth')
        : res.status === 404 || res.status === 405
          ? t(cfg.language, 'hintUrl')
          : '';
      return err(t(cfg.language, 'httpError', { status: res.status, hint, detail }));
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return err(t(cfg.language, 'nonJson'));
    }
    return ok({ text: extractText(data, apiType) });
  } catch (e) {
    if (e && e.name === 'AbortError') return err(t(cfg.language, 'timeout', { s: REQUEST_TIMEOUT_MS / 1000 }));
    return err(String((e && e.message) || e));
  } finally {
    clearTimeout(timer);
  }
}

async function readImageData(path, lang) {
  const buf = await readFile(path);
  if (buf.length === 0) throw new Error(t(lang, 'emptyImage'));
  if (buf.length > MAX_BYTES) throw new Error(t(lang, 'tooLarge'));
  const ext = extOf(buf);
  if (ext === null) throw new Error(t(lang, 'badFormat'));
  return { dataUrl: `data:${MIME[ext]};base64,${buf.toString('base64')}` };
}

/** Recognize one image path through the configured vision model. */
async function recognizeOne(path, question) {
  const { config, corrupt } = await loadConfig();
  const lang = config.language;
  if (corrupt) throw new Error(t(lang, 'corrupt'));
  if (!isConfigured(config)) throw new Error(t(lang, 'noConfig'));
  if (config.apiType === 'completions') throw new Error(t(lang, 'completionsNoImage'));
  if (typeof path !== 'string' || !isAbsolute(path)) throw new Error(t(lang, 'badPath'));
  const image = await readImageData(path, lang);
  const prompt = buildPrompt(lang, question);
  const req = config.apiType === 'responses'
    ? responsesBody(config, [image.dataUrl], prompt)
    : chatBody(config, [image.dataUrl], prompt);
  const res = await callEndpoint(config, req, config.apiType);
  if (res.ok !== true) throw new Error(res.error.message);
  return res.value.text;
}

// ── runtime skill: teach the main model to call `vision` and organize results ─
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

返回该图片的文字描述。多张图片时逐张调用，不要合并。

## 识别成功后：整理到「已识别图片」文件夹

识别完成后，在工作区创建「已识别图片」文件夹，并把结果写成 markdown：

- 描述文件：已识别图片\\NN_主题词.md（NN 为两位序号；主题词 2~10 字，只含中英文与数字，不要标点；重名则加 _2、_3…）；
- md 第一行固定记录「原图片路径」；
- 之后写完整描述（vision 返回的文字）；描述里标注「不确定」的部分如实保留；
- 图片移动规则：只有图片路径位于「pasted_images」文件夹（即通过图片存储框粘贴、由插件保存到工作区的图片）才把图片移入「已识别图片」；其他任何位置的图片（项目素材、立绘、图标、边框、皮肤素材、依赖包内图片等）一律保留原位，只写 md。

## 禁止

- 禁止说「我看不到图片」就结束任务——必须先调 vision；
- 禁止猜测、编造图片内容；看不清处标注「不确定」；
- 禁止用 read 工具读图片（read 是文本工具，识图走 vision 工具）；
- 禁止移动 / 重命名 / 删除项目素材类图片；
- 批量时禁止把多张图片合并进一次 vision 调用。`;

export function apply(ctx) {
  ctx.inject(['connection'], (scope) => {
    ctx.effect(() => scope.connection.rpc.handle(CHANNEL, async (endpoint, payload) => {
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
          // Filename is fully host-generated (timestamp + random) — never client-controlled.
          const name = `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const target = join(dir, name);
          await writeFile(target, buf, { flag: 'wx' });
          return ok({ path: target });
        }

        if (endpoint === 'get-config') {
          const { config, corrupt } = await loadConfig();
          return ok({ ...redact(config), corrupt });
        }

        if (endpoint === 'set-config') {
          const { config: current } = await loadConfig();
          const next = { ...current };
          if (typeof p.baseUrl === 'string') next.baseUrl = p.baseUrl.trim();
          if (typeof p.model === 'string') next.model = p.model.trim();
          if (API_TYPES.includes(p.apiType)) next.apiType = p.apiType;
          if (Number.isInteger(p.maxTokens) && p.maxTokens >= 0) next.maxTokens = p.maxTokens;
          if (LANGUAGES.includes(p.language)) next.language = p.language;
          if (p.clearKey === true) {
            next.apiKey = '';
          } else if (typeof p.apiKey === 'string' && p.apiKey.trim().length > 0) {
            const k = normalizeKey(p.apiKey);
            if (k === null) return err(t(next.language, 'badKey'));
            next.apiKey = k;
          }
          await persistConfig(next);
          return ok(redact(next));
        }

        if (endpoint === 'test-vision') {
          const { config: stored } = await loadConfig();
          const cfg = { ...stored };
          if (typeof p.baseUrl === 'string') cfg.baseUrl = p.baseUrl.trim();
          if (typeof p.model === 'string') cfg.model = p.model.trim();
          if (API_TYPES.includes(p.apiType)) cfg.apiType = p.apiType;
          if (Number.isInteger(p.maxTokens) && p.maxTokens >= 0) cfg.maxTokens = p.maxTokens;
          if (LANGUAGES.includes(p.language)) cfg.language = p.language;
          if (typeof p.apiKey === 'string' && p.apiKey.trim().length > 0) {
            const k = normalizeKey(p.apiKey);
            if (k === null) return err(t(cfg.language, 'badKey'));
            cfg.apiKey = k;
          }
          if (!cfg.baseUrl) return err(t(cfg.language, 'missingBaseUrl'));
          if (!cfg.model) return err(t(cfg.language, 'missingModel'));
          if (!cfg.apiKey) return err(t(cfg.language, 'missingKey'));
          const res = await callEndpoint(cfg, testBody(cfg), cfg.apiType);
          if (res.ok !== true) return res;
          return ok({ ok: true, message: 'ok', model: cfg.model, apiType: cfg.apiType });
        }

        return err(`unknown endpoint "${endpoint}"`);
      } catch (e) {
        return err(String((e && e.message) || e));
      }
    }, { authority: 'loopback' }), 'paste-image: rpc');
  });

  // Model-facing `vision` tool: recognize an image path via the configured model.
  ctx.inject(['tools'], (scope) => {
    scope.tools.register(defineTool({
      name: 'vision',
      description: '识别一张图片文件并返回文字描述（走配置好的识图模型）。参数 image_path 为图片绝对路径；可选 question 为关于该图片的具体问题。当主模型是纯文本模型、read_image 不可用或失败、或需要精确读出截图/图表/报错/扫描件内容时使用。',
      parameters: {
        image_path: { type: 'string', required: true, description: '图片文件绝对路径（.png/.jpg/.jpeg/.webp/.gif）' },
        question: { type: 'string', description: '关于该图片的具体问题，可选' }
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }]
      },
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        return recognizeOne(String(args.image_path || '').trim(), args.question);
      },
      presentCall(args) {
        return { card: 'generic', title: `识别图片 ${args.image_path}`, locations: [{ path: args.image_path }] };
      }
    }));
  });

  // Runtime skill: when + how to use `vision`, and the 已识别图片 folder workflow.
  ctx.inject(['skills'], (scope) => {
    scope.skills.register({
      name: SKILL_NAME,
      description: SKILL_DESCRIPTION,
      content: SKILL_CONTENT,
      source: 'dsh-vision-window'
    });
  });
}
