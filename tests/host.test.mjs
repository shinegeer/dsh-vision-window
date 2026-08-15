import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {
  stripThinking,
  resolveChain,
  downscaleImage,
  jpegForVision,
  internals,
  Config,
} from '../lib/index.js';

const { createCache } = internals;

test('stripThinking removes paired think blocks', () => {
  assert.equal(stripThinking('<think>推理</think>这是答案'), '这是答案');
  assert.equal(stripThinking('<thinking>r</thinking>done'), 'done');
  assert.equal(stripThinking('<reasoning>r</reasoning>ok'), 'ok');
});

test('stripThinking handles escaped, unclosed and piped tokens', () => {
  assert.equal(stripThinking('&lt;think&gt;x&lt;/think&gt;hello'), 'hello');
  assert.equal(stripThinking('这是答案<think>未闭合'), '这是答案');
  assert.equal(stripThinking('<|think|>a<|/think|>b'), 'ab');
});

test('stripThinking leaves normal text alone and returns empty for reasoning-only output', () => {
  assert.equal(stripThinking('no tags, response details'), 'no tags, response details');
  assert.equal(stripThinking('<think></think>'), '');
  assert.equal(stripThinking('<think>只有思考，没有回答</think>'), '');
});

test('resolveChain builds ordered unique providers and skips empty custom', () => {
  const chain = resolveChain({
    preset: 'opencode-go',
    fallbacks: ['opencode-zen', 'opencode-go', 'xiaomi-mimo', 'custom'],
    custom: {},
    language: 'zh',
  });
  assert.deepEqual(chain.map((p) => p.id), ['opencode-go', 'opencode-zen', 'xiaomi-mimo']);
  assert.equal(chain[0].baseUrl, 'https://opencode.ai/zen/go/v1');
  assert.equal(chain[0].model, 'mimo-v2.5');
  assert.equal(chain[1].credential, 'OPENCODE_API_KEY');
});

test('resolveChain includes a filled custom provider', () => {
  const chain = resolveChain({
    preset: 'custom',
    fallbacks: [],
    custom: { baseUrl: 'https://x.example/v1', model: 'vl-1', apiType: 'chat', credential: 'MY_KEY', maxTokens: 0 },
    language: 'en',
  });
  assert.equal(chain.length, 1);
  assert.equal(chain[0].id, 'custom');
  assert.equal(chain[0].credential, 'MY_KEY');
});

test('cache is LRU with TTL', async () => {
  const cache = createCache(2, 1000);
  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.get('a'), 1); // refreshes LRU
  cache.set('c', 3);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('c'), 3);

  const short = createCache(2, 1);
  short.set('x', 'v');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(short.get('x'), undefined);
});

test('downscaleImage shrinks oversized images below the pixel budget', async () => {
  const big = await sharp({ create: { width: 2000, height: 2000, channels: 3, background: '#336699' } })
    .png()
    .toBuffer();
  const small = await downscaleImage(big, 1_000_000);
  assert.ok(small.length < big.length);
  const meta = await sharp(small).metadata();
  assert.ok(meta.width * meta.height <= 1_000_000);
});

test('downscaleImage keeps small images untouched and tolerates garbage', async () => {
  const small = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#ffffff' } })
    .png()
    .toBuffer();
  assert.equal(await downscaleImage(small, 1_000_000), small);
  const garbage = Buffer.from(createHash('sha256').update('x').digest());
  assert.equal(await downscaleImage(garbage, 1_000_000), garbage);
});

test('jpegForVision shrinks noisy png uploads and tolerates garbage', async () => {
  const raw = Buffer.alloc(512 * 512 * 3);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 3;
      raw[i] = Math.round(x * 255 / 511);
      raw[i + 1] = Math.round(y * 255 / 511);
      raw[i + 2] = Math.round((x + y) * 127 / 511);
    }
  }
  const png = await sharp(raw, { raw: { width: 512, height: 512, channels: 3 } }).png().toBuffer();
  const jpeg = await jpegForVision(png, 82);
  assert.ok(jpeg.length < png.length);
  assert.equal((await sharp(jpeg).metadata()).format, 'jpeg');
  const garbage = Buffer.from(createHash('sha256').update('y').digest());
  assert.equal(await jpegForVision(garbage), garbage);
});

test('classifyHttpStatus maps HTTP codes to classes', () => {
  assert.equal(internals.classifyHttpStatus('zh', 401, 'bad').code, 'auth');
  assert.equal(internals.classifyHttpStatus('zh', 402, 'quota').code, 'quota');
  assert.equal(internals.classifyHttpStatus('zh', 429, 'slow').code, 'rate');
  assert.equal(internals.classifyHttpStatus('zh', 404, 'missing').code, 'endpoint');
  assert.equal(internals.classifyHttpStatus('zh', 500, 'boom').code, 'server');
});

test('providerFor resolves builtin presets', () => {
  const p = internals.providerFor({ language: 'zh' }, 'xiaomi-mimo');
  assert.equal(p.baseUrl, 'https://api.xiaomimimo.com/v1');
  assert.equal(p.model, 'mimo-v2.5');
  assert.equal(p.credential, 'XIAOMI_API_KEY');
});

test('Config schema resolves defaults and rejects invalid values', () => {
  const defaults = Config({});
  assert.equal(defaults.preset, 'opencode-go');
  assert.deepEqual(defaults.fallbacks, ['opencode-zen', 'xiaomi-mimo']);
  assert.equal(defaults.downscaleMaxPixels, 4000000);
  assert.equal(defaults.stripThink, true);
  assert.throws(() => Config({ preset: 'nope' }));
  assert.throws(() => Config({ downscaleMaxPixels: 42 }));
  assert.throws(() => Config({ timeoutMs: 10 }));
});
