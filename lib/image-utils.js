/**
 * Shared image helpers for dsh-vision-window (host + local tools).
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

/** Magic-number sniffing: the extension is decided by bytes, never by caller input. */
export function extOf(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'webp';
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif';
  return null;
}

export function sha256Prefix(buf, len = 24) {
  return createHash('sha256').update(buf).digest('hex').slice(0, len);
}

let sharpModule;
export async function loadSharp() {
  if (sharpModule) return sharpModule;
  sharpModule = await import('sharp');
  return sharpModule;
}

/** Downscale bytes whose intrinsic pixel count exceeds maxPixels; returns original bytes on failure. */
export async function downscaleImage(bytes, maxPixels) {
  try {
    const mod = await loadSharp();
    const sharp = mod.default || mod;
    const image = sharp(bytes, { failOn: 'none' });
    const meta = await image.metadata();
    if (!meta.width || !meta.height) return bytes;
    if (meta.width * meta.height <= maxPixels) return bytes;
    const scale = Math.sqrt(maxPixels / (meta.width * meta.height));
    const width = Math.max(1, Math.round(meta.width * scale));
    const height = Math.max(1, Math.round(meta.height * scale));
    const resized = await image.resize({ width, height, fit: 'inside' }).toBuffer();
    return resized.length > 0 && resized.length < bytes.length ? resized : bytes;
  } catch {
    return bytes;
  }
}

/** Read an image from disk and validate bytes/format/size. */
export async function readImageBytes(path, { maxBytes = 20 * 1024 * 1024, lang = 'en' } = {}) {
  const text = (zh, en) => (lang === 'zh' ? zh : en);
  const buf = await readFile(path);
  if (buf.length === 0) throw new Error(text('图片为空', 'image is empty'));
  if (buf.length > maxBytes) throw new Error(text('图片超过 20 MiB 上限', 'image exceeds the 20 MiB limit'));
  const ext = extOf(buf);
  if (ext === null) throw new Error(text('不支持的图片格式（仅 png/jpg/webp/gif）', 'unsupported image format (png/jpg/webp/gif only)'));
  return { buf, ext, fingerprint: sha256Prefix(buf) };
}
