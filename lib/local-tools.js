/**
 * Zero-config local vision tools for dsh-vision-window.
 *
 * These tools never touch provider settings or DSH credentials. They run on
 * sharp / potrace / system tesseract / system Chrome and write artifacts into
 * `<session cwd>/.dsh-vision-window/artifacts` (configurable via
 * `vision-window.artifactsDir`).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve, isAbsolute, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { loadSharp, readImageBytes, downscaleImage } from './image-utils.js';

const execFileAsync = promisify(execFile);
const LOCAL_DEFAULT_ARTIFACTS = '.dsh-vision-window/artifacts';
const LOCAL_MAX_PIXELS = 16_000_000;

const MSG = {
  disabled: ['本地像素/OCR 工具已被关闭（settings 里 localTools=false）', 'Local pixel/OCR tools are disabled (localTools=false in settings)'],
  none: ['无', 'none'],
  badPath: ['图片路径必须为绝对路径', 'Image paths must be absolute'],
  badRegion: ['region 格式应为 "x1,y1,x2,y2"，且 x2>x1、y2>y1', 'region must be "x1,y1,x2,y2" with x2>x1 and y2>y1'],
  outOfBounds: ['裁剪区域超出图片边界（图片 {w}x{h}）', 'Crop region is outside the image ({w}x{h})'],
  tooManyPixels: ['图片像素数超过本地工具上限（{n} MP），请先缩小图片', 'Image exceeds the local-tool pixel limit ({n} MP); resize it first'],
  dimensionsDiffer: ['两张图尺寸不同，已把 rebuilt 缩放到 original 的尺寸后比较', 'Images differ in size; rebuilt was resized to the original dimensions before comparing'],
  tesseractMissing: ['未检测到系统 tesseract。请安装 Tesseract OCR（Windows: UB-Mannheim 安装包）后重试；或在 ⚙ 里配置视觉供应商后改用 vision 工具', 'System tesseract not found. Install Tesseract OCR (Windows: UB-Mannheim build) and retry, or configure a vision provider and use the vision tool instead'],
  ocrEmpty: ['tesseract 未返回文字', 'tesseract returned no text'],
  browserMissing: ['未找到 Chrome/Edge。设置 CHROME_PATH 环境变量指向浏览器可执行文件后重试', 'Chrome/Edge not found. Set the CHROME_PATH environment variable to the browser executable and retry'],
  cropOk: ['已裁剪 {w}x{h}（区域 {region}）→ {path}', 'Cropped {w}x{h} (region {region}) → {path}'],
  diffOk: ['像素差异率 {ratio}%（差异 {n}/{total} 像素，threshold {t}/通道）；最差区域（8×8 网格）：{top}；热力图 → {heat}；报告 → {report}', 'Pixel diff ratio {ratio}% ({n}/{total} pixels differ, threshold {t}/channel); worst 8×8 grid regions: {top}; heatmap → {heat}; report → {report}'],
  colorsOk: ['主色（top {top}）：\n{colors}', 'Dominant colors (top {top}):\n{colors}'],
  traceOk: ['SVG 矢量化完成（{paths} 条路径，{w}x{h}）→ {path}', 'SVG trace done ({paths} paths, {w}x{h}) → {path}'],
  fgOk: ['前景提取完成：移除约 {ratio}% 的边界连通背景像素 → {path}', 'Foreground extracted: removed ~{ratio}% of border-connected background pixels → {path}'],
  shotOk: ['已截图 {w}x{h} → {path}', 'Screenshot {w}x{h} saved → {path}'],
  error: ['本地工具失败：{detail}', 'Local tool failed: {detail}'],
};

function t(lang, key, vars) {
  const entry = MSG[key];
  let s = entry ? (lang === 'en' ? entry[1] : entry[0]) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

async function readLocalImage(path, config) {
  return readImageBytes(path, { lang: config?.language || 'zh' });
}

export function checkLocalTools(config) {
  if (config?.localTools === false) throw new Error(t(config?.language || 'zh', 'disabled'));
}

function assertAbsolute(path, lang) {
  if (typeof path !== 'string' || !isAbsolute(path.trim())) throw new Error(t(lang, 'badPath'));
  return path.trim();
}

function parseRegion(raw, lang) {
  if (typeof raw !== 'string') throw new Error(t(lang, 'badRegion'));
  const parts = raw.split(',').map((x) => Number(String(x).trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) throw new Error(t(lang, 'badRegion'));
  const [x1, y1, x2, y2] = parts.map((n) => Math.round(n));
  if (x2 <= x1 || y2 <= y1) throw new Error(t(lang, 'badRegion'));
  return { x1, y1, x2, y2 };
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function sessionCwd(exec, fallbackDir) {
  const cwd = exec?.agent?.session?.header?.cwd;
  return typeof cwd === 'string' && cwd.trim() !== '' ? cwd : fallbackDir;
}

function artifactsRoot(config, exec, imagePath) {
  const base = sessionCwd(exec, dirname(imagePath));
  const rel = (config && typeof config.artifactsDir === 'string' && config.artifactsDir.trim()) || LOCAL_DEFAULT_ARTIFACTS;
  return isAbsolute(rel) ? rel : resolve(base, rel);
}

async function writeArtifact(root, stem, buf, ext) {
  await mkdir(root, { recursive: true });
  const name = `${stem}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const target = join(root, name);
  await writeFile(target, buf);
  return target;
}

async function sharpMeta(bytes) {
  const mod = await loadSharp();
  const sharp = mod.default || mod;
  return sharp(bytes, { failOn: 'none' }).metadata();
}

async function ensureBudget(bytes, config) {
  const budget = config.downscale === false ? LOCAL_MAX_PIXELS : clampInt(config.downscaleMaxPixels, 4_000_000, 1000, LOCAL_MAX_PIXELS);
  const meta = await sharpMeta(bytes);
  if (meta.width * meta.height > budget) {
    if (config.downscale === false && meta.width * meta.height > LOCAL_MAX_PIXELS) {
      throw new Error(t(config.language, 'tooManyPixels', { n: LOCAL_MAX_PIXELS / 1_000_000 }));
    }
    const prepared = await downscaleImage(bytes, budget);
    return { bytes: prepared, resized: true, meta: await sharpMeta(prepared) };
  }
  return { bytes, resized: false, meta };
}

// ── individual runners ───────────────────────────────────────────────────────
export async function runCrop(args, config, exec) {
  const image = assertAbsolute(args.image, config.language);
  const region = parseRegion(args.region, config.language);
  const { buf } = await readLocalImage(image, config);
  const mod = await loadSharp();
  const sharp = mod.default || mod;
  const meta = await sharp(buf).metadata();
  if (region.x1 < 0 || region.y1 < 0 || region.x2 > meta.width || region.y2 > meta.height) {
    throw new Error(t(config.language, 'outOfBounds', { w: meta.width, h: meta.height }));
  }
  const out = await sharp(buf).extract({
    left: region.x1,
    top: region.y1,
    width: region.x2 - region.x1,
    height: region.y2 - region.y1,
  }).png().toBuffer();
  const root = artifactsRoot(config, exec, image);
  const path = await writeArtifact(root, 'vw_crop', out, 'png');
  return t(config.language, 'cropOk', { w: region.x2 - region.x1, h: region.y2 - region.y1, region: `${region.x1},${region.y1},${region.x2},${region.y2}`, path });
}

export async function runPixelDiff(args, config, exec) {
  const originalPath = assertAbsolute(args.original, config.language);
  const rebuiltPath = assertAbsolute(args.rebuilt, config.language);
  const threshold = clampInt(args.threshold, 16, 0, 255);
  const { buf: original } = await readLocalImage(originalPath, config);
  const { buf: rebuiltRaw } = await readLocalImage(rebuiltPath, config);
  const mod = await loadSharp();
  const sharp = mod.default || mod;
  let prepared = (await ensureBudget(original, config)).bytes;
  const originalMeta = await sharp(prepared).metadata();
  let rebuilt = rebuiltRaw;
  const rebuiltMeta = await sharp(rebuiltRaw).metadata();
  let resizedRebuilt = false;
  if (rebuiltMeta.width !== originalMeta.width || rebuiltMeta.height !== originalMeta.height) {
    rebuilt = await sharp(rebuiltRaw).resize(originalMeta.width, originalMeta.height, { fit: 'fill' }).ensureAlpha().png().toBuffer();
    resizedRebuilt = true;
  }
  const originalRaw = await sharp(prepared).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rebuiltRes = await sharp(rebuilt).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: a, info } = originalRaw;
  const b = rebuiltRes.data;
  const total = info.width * info.height;
  const heat = Buffer.alloc(total * 4);
  let diffCount = 0;
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    const differ = Math.abs(a[o] - b[o]) > threshold
      || Math.abs(a[o + 1] - b[o + 1]) > threshold
      || Math.abs(a[o + 2] - b[o + 2]) > threshold
      || Math.abs(a[o + 3] - b[o + 3]) > threshold;
    if (differ) {
      diffCount++;
      heat[o] = 255; heat[o + 1] = 0; heat[o + 2] = 0; heat[o + 3] = 180;
    }
  }
  const ratio = total === 0 ? 0 : (diffCount / total) * 100;
  const heatPng = await sharp(heat, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const grid = 8;
  const counts = new Array(grid * grid).fill(0);
  const gw = Math.max(1, Math.floor(info.width / grid));
  const gh = Math.max(1, Math.floor(info.height / grid));
  for (let i = 0; i < total; i++) {
    if (heat[i * 4 + 3] === 0) continue;
    const gx = Math.min(grid - 1, Math.floor((i % info.width) / gw));
    const gy = Math.min(grid - 1, Math.floor(Math.floor(i / info.width) / gh));
    counts[gy * grid + gx]++;
  }
  const ranked = counts
    .map((count, idx) => {
      const gx = idx % grid;
      const gy = Math.floor(idx / grid);
      const x = gx * gw;
      const y = gy * gh;
      return { count, x, y, w: Math.min(gw, info.width - x), h: Math.min(gh, info.height - y) };
    })
    .filter((r) => r.count > 0)
    .sort((p, q) => q.count - p.count)
    .slice(0, 5)
    .map((r) => `${r.x},${r.y},${r.x + r.w},${r.y + r.h}:${r.count}`);
  const topList = ranked.length > 0 ? ranked.join(config.language === 'en' ? '; ' : '；') : t(config.language, 'none');
  const root = artifactsRoot(config, exec, originalPath);
  const heatPath = await writeArtifact(root, 'vw_pixel_diff', heatPng, 'png');
  const report = {
    original: originalPath,
    rebuilt: rebuiltPath,
    threshold,
    width: info.width,
    height: info.height,
    totalPixels: total,
    diffPixels: diffCount,
    ratio: Number(ratio.toFixed(4)),
    resizedRebuilt,
    worstRegions: ranked,
  };
  const reportPath = await writeArtifact(root, 'vw_pixel_diff_report', Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8'), 'json');
  const note = resizedRebuilt ? `${config.language === 'en' ? '; ' : '；'}${t(config.language, 'dimensionsDiffer')}` : '';
  return t(config.language, 'diffOk', {
    ratio: ratio.toFixed(2),
    n: diffCount,
    total,
    t: threshold,
    top: topList,
    heat: heatPath,
    report: reportPath,
  }) + note;
}

export async function runColors(args, config) {
  const image = assertAbsolute(args.image, config.language);
  const top = clampInt(args.top, 8, 1, 32);
  const { buf } = await readLocalImage(image, config);
  const prepared = (await ensureBudget(buf, config)).bytes;
  const mod = await loadSharp();
  const sharp = mod.default || mod;
  const { data, info } = await sharp(prepared).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // transparent pixels do not count
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  const total = [...buckets.values()].reduce((a, b) => a + b, 0) || 1;
  const colors = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([key, count]) => {
      const r = (((key >> 10) & 31) * 8 + 4).toString(16).padStart(2, '0');
      const g = (((key >> 5) & 31) * 8 + 4).toString(16).padStart(2, '0');
      const b = ((key & 31) * 8 + 4).toString(16).padStart(2, '0');
      return `#${r}${g}${b} — ${((count / total) * 100).toFixed(2)}%`;
    });
  return t(config.language, 'colorsOk', { top, colors: colors.join('\n') });
}

export async function runTrace(args, config, exec) {
  const image = assertAbsolute(args.image, config.language);
  const steps = clampInt(args.steps, 4, 1, 8);
  const { buf } = await readLocalImage(image, config);
  const budget = 1_000_000; // vw_trace hard cap, independent of the vision downscale setting
  const sourceMeta = await sharpMeta(buf);
  if (sourceMeta.width * sourceMeta.height > budget && config.downscale === false) {
    throw new Error(t(config.language, 'tooManyPixels', { n: budget / 1_000_000 }));
  }
  const prepared = await downscaleImage(buf, budget);
  const meta = await sharpMeta(prepared);
  if (meta.width * meta.height > budget) {
    throw new Error(t(config.language, 'tooManyPixels', { n: budget / 1_000_000 }));
  }
  const mod = await import('potrace');
  const potrace = mod.default || mod;
  const svg = await new Promise((resolve, reject) => {
    potrace.trace(prepared, { steps }, (error, result) => {
      if (error) reject(error);
      else resolve(String(result || ''));
    });
  });
  const pathCount = (svg.match(/<path/g) || []).length;
  const root = artifactsRoot(config, exec, image);
  const path = await writeArtifact(root, 'vw_trace', Buffer.from(svg, 'utf8'), 'svg');
  return t(config.language, 'traceOk', { paths: pathCount, w: meta.width, h: meta.height, path });
}

let tesseractStatus = { checkedAt: 0, ok: false, failed: false };
export async function runOcr(args, config, options = {}) {
  const image = assertAbsolute(args.image, config.language);
  const lang = typeof args.lang === 'string' && args.lang.trim() ? args.lang.trim() : 'chi_sim+eng';
  await readLocalImage(image, config); // validate format/size before spawning tesseract
  const command = options.command || 'tesseract';
  const extraArgs = Array.isArray(options.extraArgs) ? options.extraArgs : [];
  const now = Date.now();
  if (!tesseractStatus.checkedAt || now - tesseractStatus.checkedAt > 60_000) {
    try {
      await execFileAsync(command, ['--version'], { timeout: 15_000, windowsHide: true });
      tesseractStatus = { checkedAt: now, ok: true, failed: false };
    } catch {
      tesseractStatus = { checkedAt: now, ok: false, failed: true };
    }
  }
  if (tesseractStatus.failed) throw new Error(t(config.language, 'tesseractMissing'));
  const { stdout } = await execFileAsync(command, [...extraArgs, image, 'stdout', '-l', lang], {
    timeout: 180_000,
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });
  const text = String(stdout || '').replace(/\r\n/g, '\n').trim();
  if (!text) throw new Error(t(config.language, 'ocrEmpty'));
  return text;
}

function browserCandidates() {
  const env = process.env.CHROME_PATH;
  const candidates = [];
  if (env) candidates.push(env);
  if (process.platform === 'win32') {
    if (process.env.LOCALAPPDATA) {
      candidates.push(
        join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
        join(process.env.LOCALAPPDATA, 'Microsoft\\Edge\\Application\\msedge.exe'),
      );
    }
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    );
  } else {
    candidates.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge');
  }
  return candidates.filter((p) => existsSync(p));
}

export async function runHtmlScreenshot(args, config, exec) {
  const source = assertAbsolute(args.source, config.language);
  const width = clampInt(args.width, 1200, 1, 8192);
  const height = clampInt(args.height, 720, 1, 8192);
  const [browser] = browserCandidates();
  if (!browser) throw new Error(t(config.language, 'browserMissing'));
  const mod = await import('puppeteer-core');
  const puppeteer = mod.default || mod;
  const browserInstance = await puppeteer.launch({ executablePath: browser, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browserInstance.newPage();
    // Load only the local file: abort every non-file request so the page cannot
    // beacon data or fetch remote resources (network egress stays zero).
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().startsWith('file:')) request.continue();
      else request.abort('blockedbyclient');
    });
    await page.setViewport({ width, height });
    await page.goto(pathToFileURL(source).href, { waitUntil: 'load', timeout: 60_000 });
    const png = await page.screenshot({ type: 'png', fullPage: false });
    const root = artifactsRoot(config, exec, source);
    const path = await writeArtifact(root, 'vw_html_screenshot', png, 'png');
    return t(config.language, 'shotOk', { w: width, h: height, path });
  } finally {
    await browserInstance.close().catch(() => {});
  }
}

export async function runExtractForeground(args, config, exec) {
  const image = assertAbsolute(args.image, config.language);
  const tolerance = clampInt(args.tolerance, 30, 0, 255);
  const { buf } = await readLocalImage(image, config);
  const prepared = (await ensureBudget(buf, config)).bytes;
  const mod = await loadSharp();
  const sharp = mod.default || mod;
  const { data, info } = await sharp(prepared).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = [];
  const colorAt = (idx) => {
    const i = idx * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const pushSeed = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    const [r, g, b] = colorAt(idx);
    queue.push({ idx, r, g, b });
  };
  for (let x = 0; x < width; x++) { pushSeed(x, 0); pushSeed(x, height - 1); }
  for (let y = 0; y < height; y++) { pushSeed(0, y); pushSeed(width - 1, y); }
  let removed = 0;
  let head = 0;
  while (head < queue.length) {
    const { idx, r, g, b } = queue[head++];
    const x = idx % width;
    const y = Math.floor(idx / width);
    const i = idx * 4;
    const similar = Math.abs(data[i] - r) <= tolerance
      && Math.abs(data[i + 1] - g) <= tolerance
      && Math.abs(data[i + 2] - b) <= tolerance;
    if (!similar) continue;
    removed++;
    data[i + 3] = 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (visited[nIdx]) continue;
      visited[nIdx] = 1;
      queue.push({ idx: nIdx, r, g, b });
    }
  }
  const out = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const root = artifactsRoot(config, exec, image);
  const path = await writeArtifact(root, 'vw_extract_foreground', out, 'png');
  const ratio = total === 0 ? 0 : (removed / total) * 100;
  return t(config.language, 'fgOk', { ratio: ratio.toFixed(2), path });
}

// ── tool definitions ─────────────────────────────────────────────────────────
const DEFINITIONS = [
  {
    name: 'vw_crop',
    description: '按像素框裁剪图片并保存为 PNG（本地 sharp，零配置）。image 为图片绝对路径；region 为 "x1,y1,x2,y2"。',
    parameters: {
      image: { type: 'string', required: true, description: '图片文件绝对路径' },
      region: { type: 'string', required: true, description: '原图像素框 "x1,y1,x2,y2"（x2>x1, y2>y1）' },
    },
    locations: (args) => [{ path: args.image }],
    title: (args) => `裁剪图片 ${args.image}`,
    run: (args, config, exec) => runCrop(args, config, exec),
  },
  {
    name: 'vw_pixel_diff',
    description: '逐像素对比两张图片（本地 sharp，零配置）：返回差异率、差异像素数、最差 8×8 网格区域，并生成红色热力图 PNG + JSON 报告。',
    parameters: {
      original: { type: 'string', required: true, description: '参照图绝对路径' },
      rebuilt: { type: 'string', required: true, description: '实现/截图绝对路径' },
      threshold: { type: 'number', description: '每通道差异阈值 0-255，默认 16' },
    },
    locations: (args) => [{ path: args.original }, { path: args.rebuilt }],
    title: (args) => `像素对比 ${args.original}`,
    run: (args, config, exec) => runPixelDiff(args, config, exec),
  },
  {
    name: 'vw_colors',
    description: '提取图片主色（本地 sharp，零配置）：返回 hex 颜色及占比。',
    parameters: {
      image: { type: 'string', required: true, description: '图片绝对路径' },
      top: { type: 'number', description: '返回前 N 个颜色，默认 8，最大 32' },
    },
    locations: (args) => [{ path: args.image }],
    title: (args) => `提取主色 ${args.image}`,
    run: (args, config, exec) => runColors(args, config),
  },
  {
    name: 'vw_trace',
    description: '把位图矢量化成 SVG（本地 potrace，零配置），适合图标/logo。',
    parameters: {
      image: { type: 'string', required: true, description: '图片绝对路径' },
      steps: { type: 'number', description: '颜色量化层数 1-8，默认 4' },
    },
    locations: (args) => [{ path: args.image }],
    title: (args) => `SVG 矢量化 ${args.image}`,
    run: (args, config, exec) => runTrace(args, config, exec),
  },
  {
    name: 'vw_ocr',
    description: '本地 OCR 文字转写（系统 tesseract，零配置；中英默认 chi_sim+eng）。未安装 tesseract 时会返回安装指引。',
    parameters: {
      image: { type: 'string', required: true, description: '图片绝对路径' },
      lang: { type: 'string', description: 'tesseract 语言参数，默认 chi_sim+eng' },
    },
    locations: (args) => [{ path: args.image }],
    title: (args) => `OCR ${args.image}`,
    run: (args, config, exec) => runOcr(args, config),
  },
  {
    name: 'vw_html_screenshot',
    description: '用系统 Chrome/Edge 给本地 HTML 截图（puppeteer-core，零配置）。需要已安装 Chrome/Edge 或设置 CHROME_PATH。',
    parameters: {
      source: { type: 'string', required: true, description: '本地 HTML 文件绝对路径' },
      width: { type: 'number', description: '视口宽度，默认 1200' },
      height: { type: 'number', description: '视口高度，默认 720' },
    },
    locations: (args) => [{ path: args.source }],
    title: (args) => `HTML 截图 ${args.source}`,
    run: (args, config, exec) => runHtmlScreenshot(args, config, exec),
  },
  {
    name: 'vw_extract_foreground',
    description: '从图片中提取前景：移除与边界连通、颜色接近的背景像素（本地洪泛，零配置），适合纯色/近纯色背景抠图。',
    parameters: {
      image: { type: 'string', required: true, description: '图片绝对路径' },
      tolerance: { type: 'number', description: '边界背景颜色容差 0-255，默认 30' },
    },
    locations: (args) => [{ path: args.image }],
    title: (args) => `前景提取 ${args.image}`,
    run: (args, config, exec) => runExtractForeground(args, config, exec),
  },
];

export function registerLocalTools(toolsCtx, getConfig) {
  const disposers = [];
  for (const def of DEFINITIONS) {
    const disposer = toolsCtx.tools.register(defineTool({
      name: def.name,
      description: def.description,
      parameters: def.parameters,
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        const config = getConfig();
        checkLocalTools(config);
        return def.run(args, config, exec);
      },
      presentCall(args) {
        return { card: 'generic', title: def.title(args), locations: def.locations(args) };
      },
    }));
    disposers.push(disposer);
  }
  return () => disposers.forEach((d) => d());
}
