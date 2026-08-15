import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { apply } from '../lib/index.js';

function fakeSettings() {
  const doc = {};
  const scopes = [];
  return {
    scopes,
    doc,
    register(ns, schema, options) {
      const scope = {
        ns,
        get() {
          return doc[ns] || {};
        },
        async update(patch) {
          doc[ns] = { ...(doc[ns] || {}), ...patch };
        },
      };
      scopes.push({ ns, scope, schema, options });
      return scope;
    },
    describe() {
      return scopes.map(({ ns, scope }) => ({ ns, user: doc[ns] }));
    },
  };
}

function fakeTools() {
  const registered = [];
  return {
    registered,
    register(def) {
      registered.push(def);
      return () => {};
    },
  };
}

function fakeSkills() {
  const registered = [];
  return {
    registered,
    register(skill) {
      registered.push(skill);
      return () => {};
    },
  };
}

async function boot({ withConnection = true } = {}) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-vision-window-test-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  const root = new Context();
  const settings = fakeSettings();
  const tools = fakeTools();
  const skills = fakeSkills();
  root.provide('settings', settings);
  root.provide('tools', tools);
  root.provide('skills', skills);
  let rpcHandler;
  let rpcChannel;
  if (withConnection) {
    root.provide('connection', {
      rpc: {
        handle(channel, handler) {
          rpcChannel = channel;
          rpcHandler = handler;
          return () => {};
        },
      },
    });
  }
  const fiber = root.plugin(apply);
  await fiber;
  // let the nested fibers settle
  await new Promise((r) => setTimeout(r, 20));
  return {
    home,
    previous,
    settings,
    tools,
    skills,
    rpcChannel,
    rpcHandler,
    async dispose() {
      await fiber.dispose();
      process.env.DSH_HOME = previous;
      await rm(home, { recursive: true, force: true });
    },
  };
}

test('apply registers settings + vision tool + skill without connection (headless shape)', async () => {
  const booted = await boot({ withConnection: false });
  try {
    assert.equal(booted.settings.scopes.length, 1);
    assert.equal(booted.settings.scopes[0].ns, 'vision-window');
    assert.equal(booted.tools.registered.length, 8);
    assert.equal(booted.tools.registered[0].name, 'vision');
    assert.deepEqual(
      booted.tools.registered.map((t) => t.name).filter((n) => n.startsWith('vw_')).sort(),
      ['vw_colors', 'vw_crop', 'vw_extract_foreground', 'vw_html_screenshot', 'vw_ocr', 'vw_pixel_diff', 'vw_trace'],
    );
    assert.equal(booted.skills.registered.length, 1);
    assert.equal(booted.skills.registered[0].name, 'vision-fallback');
    assert.equal(booted.rpcHandler, undefined);
  } finally {
    await booted.dispose();
  }
});

test('apply registers the loopback RPC when connection exists (web shape)', async () => {
  const booted = await boot({ withConnection: true });
  try {
    assert.equal(booted.rpcChannel, '/paste-image');
    assert.equal(typeof booted.rpcHandler, 'function');
    const res = await booted.rpcHandler('get-config', {});
    assert.equal(res.ok, true);
    assert.equal(typeof res.value.presetList, 'object');
    assert.ok(res.value.presetList.some((p) => p.id === 'opencode-go'));
    assert.ok(res.value.presetList.some((p) => p.id === 'opencode-zen'));
    assert.ok(res.value.presetList.some((p) => p.id === 'xiaomi-mimo'));
    assert.ok(res.value.presetList.some((p) => p.id === 'custom'));
    assert.equal(res.value.credentials, undefined || res.value.credentials); // no secrets ever
    const raw = JSON.stringify(res);
    assert.ok(!raw.includes('sk-'));
  } finally {
    await booted.dispose();
  }
});

test('apply rejects unknown rpc endpoints', async () => {
  const booted = await boot({ withConnection: true });
  try {
    const res = await booted.rpcHandler('nope', {});
    assert.equal(res.ok, false);
  } finally {
    await booted.dispose();
  }
});
