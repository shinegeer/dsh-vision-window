import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  runCrop,
  runPixelDiff,
  runColors,
  runTrace,
  runOcr,
  runExtractForeground,
  checkLocalTools,
} from '../lib/local-tools.js';

async function fixture({ width = 20, height = 20 } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'vw-local-tools-'));
  return {
    dir,
    async write(name, fn) {
      const path = join(dir, name);
      await fn(path);
      return path;
    },
    exec: { agent: { session: { header: { cwd: dir } } } },
    config: {
      language: 'zh',
      localTools: true,
      downscale: true,
      downscaleMaxPixels: 4_000_000,
      artifactsDir: '.dsh-vision-window/artifacts',
      ...(await noop()),
      width,
      height,
    },
    async cleanup() {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

async function noop() {
  return {};
}

test('vw crop cuts the requested pixel box', async () => {
  const f = await fixture();
  try {
    const img = await f.write('in.png', async (p) => {
      await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ffffff' } })
        .composite([{ input: Buffer.from(`<svg width="20" height="20"><rect x="0" y="0" width="10" height="20" fill="#ff0000"/></svg>`), left: 0, top: 0 }])
        .png()
        .toFile(p);
    });
    const text = await runCrop({ image: img, region: '0,0,10,10' }, f.config, f.exec);
    const path = text.match(/→ (.*)$/m)[1];
    const meta = await sharp(path).metadata();
    assert.equal(meta.width, 10);
    assert.equal(meta.height, 10);
  } finally {
    await f.cleanup();
  }
});

test('vw pixel diff reports ratio and writes heatmap + report', async () => {
  const f = await fixture();
  try {
    const original = await f.write('a.png', (p) => sharp({ create: { width: 20, height: 20, channels: 3, background: '#000000' } }).png().toFile(p));
    const rebuilt = await f.write('b.png', (p) => sharp({ create: { width: 20, height: 20, channels: 3, background: '#000000' } })
      .composite([{ input: Buffer.from(`<svg width="20" height="20"><rect x="2" y="2" width="4" height="4" fill="#ffffff"/></svg>`), left: 0, top: 0 }])
      .png()
      .toFile(p));
    const text = await runPixelDiff({ original, rebuilt, threshold: 16 }, f.config, f.exec);
    assert.match(text, /差异率 4\.00%/);
    const paths = text.match(/→ ([^；\n]+)/g).map((m) => m.replace('→ ', ''));
    assert.equal(paths.length, 2);
    assert.equal((await sharp(paths[0]).metadata()).width, 20);
    const report = JSON.parse(await readFile(paths[1], 'utf8'));
    assert.equal(report.diffPixels, 16);
    assert.equal(report.ratio, 4);
  } finally {
    await f.cleanup();
  }
});

test('vw colors lists dominant colors with shares', async () => {
  const f = await fixture();
  try {
    const img = await f.write('c.png', (p) => sharp({ create: { width: 20, height: 10, channels: 3, background: '#ff0000' } })
      .composite([{ input: Buffer.from(`<svg width="20" height="10"><rect x="10" y="0" width="10" height="10" fill="#0000ff"/></svg>`), left: 0, top: 0 }])
      .png()
      .toFile(p));
    const text = await runColors({ image: img, top: 2 }, f.config, f.exec);
    assert.match(text, /#fc0404/); // quantized red
    assert.match(text, /#0404fc/); // quantized blue
  } finally {
    await f.cleanup();
  }
});

test('vw trace produces an svg artifact', async () => {
  const f = await fixture();
  try {
    const img = await f.write('t.png', (p) => sharp({ create: { width: 32, height: 32, channels: 3, background: '#ffffff' } })
      .composite([{ input: Buffer.from(`<svg width="32" height="32"><rect x="8" y="8" width="16" height="16" fill="#000000"/></svg>`), left: 0, top: 0 }])
      .png()
      .toFile(p));
    const text = await runTrace({ image: img, steps: 2 }, f.config, f.exec);
    const path = text.match(/→ (.*)$/m)[1];
    const svg = await readFile(path, 'utf8');
    assert.match(svg, /<svg/);
    assert.match(text, /SVG 矢量化完成/);
  } finally {
    await f.cleanup();
  }
});

test('vw trace enforces its 1 MP cap even when downscale is off', async () => {
  const f = await fixture();
  try {
    const img = await f.write('big.png', (p) => sharp({ create: { width: 1200, height: 1200, channels: 3, background: '#ffffff' } }).png().toFile(p));
    await assert.rejects(
      runTrace({ image: img, steps: 2 }, { ...f.config, downscale: false }, f.exec),
      /上限（1 MP）/,
    );
  } finally {
    await f.cleanup();
  }
});

test('vw ocr shells out to the configured command', async () => {
  const f = await fixture();
  try {
    const img = await f.write('ocr.png', (p) => sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } }).png().toFile(p));
    const text = await runOcr({ image: img, lang: 'eng' }, f.config, {
      command: process.execPath,
      extraArgs: ['-e', 'console.log("OCR_OK")'],
    });
    assert.equal(text, 'OCR_OK');
  } finally {
    await f.cleanup();
  }
});

test('vw extract foreground removes border-connected background', async () => {
  const f = await fixture();
  try {
    const img = await f.write('fg.png', (p) => sharp({ create: { width: 20, height: 20, channels: 3, background: '#ffffff' } })
      .composite([{ input: Buffer.from(`<svg width="20" height="20"><rect x="5" y="5" width="10" height="10" fill="#ff0000"/></svg>`), left: 0, top: 0 }])
      .png()
      .toFile(p));
    const text = await runExtractForeground({ image: img, tolerance: 20 }, f.config, f.exec);
    const path = text.match(/→ (.*)$/m)[1];
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(data[3], 0); // corner background removed
    const center = (10 * info.width + 10) * 4;
    assert.equal(data[center + 3], 255); // red square kept
    assert.match(text, /前景提取完成/);
  } finally {
    await f.cleanup();
  }
});

test('vw extract foreground finishes on a large uniform image', async () => {
  const f = await fixture();
  try {
    const img = await f.write('solid.png', (p) => sharp({ create: { width: 256, height: 256, channels: 3, background: '#ffffff' } }).png().toFile(p));
    const text = await runExtractForeground({ image: img, tolerance: 10 }, f.config, f.exec);
    assert.match(text, /100\.00%/); // every border-connected pixel removed
  } finally {
    await f.cleanup();
  }
});

test('local tools refuse to run when localTools is disabled', async () => {
  const f = await fixture();
  try {
    const img = await f.write('x.png', (p) => sharp({ create: { width: 8, height: 8, channels: 3, background: '#000000' } }).png().toFile(p));
    assert.throws(
      () => checkLocalTools({ ...f.config, localTools: false }),
      /本地像素\/OCR 工具已被关闭/,
    );
  } finally {
    await f.cleanup();
  }
});
