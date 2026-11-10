import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  jevKeyPreview, readJevKey, saveJevKey, SET_JEV_KEY,
} from '../../../plugin-src/host/channels/weixin/jev-key.mjs';
import { testJevService } from '../../../plugin-src/host/channels/weixin/jev-service.mjs';
import {
  createRouterSettingsStore,
  DEFAULT_JEV_ENDPOINT,
  ROUTER_STATUS_ENDPOINT,
  routerSettingsPath,
  SET_ROUTER_SETTINGS_ENDPOINT,
  TEST_JEV_SERVICE_ENDPOINT,
} from '../../../plugin-src/host/channels/weixin/router-settings.mjs';
import { createWeixinRpcHandler } from '../../../plugin-src/host/channels/weixin/rpc.mjs';

function controllerStub() {
  return Object.fromEntries([
    'status', 'startProvisioning', 'registrationStatus', 'submitVerification',
    'cancelProvisioning', 'reconnectBot', 'deleteBot',
  ].map((method) => [method, () => assert.fail(method)]));
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-jev-settings-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const keyPath = join(directory, 'private', 'jev.key');
  const config = { sessionRouter: { jevKeyFile: keyPath } };
  return { directory, keyPath, config };
}

test('Weixin management saves and replaces the Jev key without returning it', async (t) => {
  const { keyPath } = await fixture(t);
  const rpc = createWeixinRpcHandler(controllerStub(), { setJevKey: (key) => saveJevKey(keyPath, key) });
  assert.equal((await rpc(SET_JEV_KEY, { apiKey: 'invalid key' })).ok, false);
  await assert.rejects(readFile(keyPath), { code: 'ENOENT' });
  for (const key of ['test-key-one', 'test-key-two']) {
    assert.deepEqual(await rpc(SET_JEV_KEY, { apiKey: key }), { ok: true, value: { saved: true } });
    assert.equal(await readFile(keyPath, 'utf8'), key);
    assert.equal((await stat(keyPath)).mode & 0o777, 0o600);
    assert.equal(await readJevKey(keyPath), key);
  }
  assert.equal(jevKeyPreview('test-key-two'), '••••-two');
});

test('Jev key write failures log only a safe system error code', async () => {
  const warnings = [];
  const rpc = createWeixinRpcHandler(controllerStub(), {
    setJevKey: async () => {
      throw Object.assign(new Error('/private/path contains secret-value'), { code: 'EACCES' });
    },
    logger: { warn: (message) => warnings.push(message) },
  });

  assert.deepEqual(await rpc(SET_JEV_KEY, { apiKey: 'synthetic-key' }), {
    ok: false,
    error: { code: 'jev-key-save-failed', message: '无法保存 Jev API Key，请重试。' },
  });
  assert.deepEqual(warnings, ['[dsh-weixin] Jev API Key save failed (EACCES)']);
  assert.doesNotMatch(warnings.join(' '), /private\/path|secret-value|synthetic-key/u);
});

test('smart switching status, settings and service test use the saved key safely', async (t) => {
  const { keyPath, config } = await fixture(t);
  const settings = createRouterSettingsStore(config, { enabled: true });
  await settings.load();
  await saveJevKey(keyPath, 'synthetic-key-1234');
  const rpc = createWeixinRpcHandler(controllerStub(), {
    routerSettings: settings,
    routerConfigured: true,
    readJevKey: () => readJevKey(keyPath),
    testJev: async () => ({ state: 'ok', httpStatus: 200, latencyMs: 12 }),
  });

  assert.deepEqual(await rpc(ROUTER_STATUS_ENDPOINT, {}), {
    ok: true,
    value: {
      enabled: true,
      endpoint: DEFAULT_JEV_ENDPOINT,
      classifyConfigured: true,
      hasApiKey: true,
      apiKeyPreview: '••••1234',
    },
  });
  assert.doesNotMatch(JSON.stringify(await rpc(ROUTER_STATUS_ENDPOINT, {})), /synthetic-key/u);

  assert.deepEqual(await rpc(SET_ROUTER_SETTINGS_ENDPOINT, {
    enabled: false, endpoint: 'https://jev.example/v1/classify',
  }), {
    ok: true,
    value: { enabled: false, endpoint: 'https://jev.example/v1/classify' },
  });
  assert.deepEqual(settings.get(), {
    version: 1, enabled: false, endpoint: 'https://jev.example/v1/classify',
  });
  assert.deepEqual(await rpc(TEST_JEV_SERVICE_ENDPOINT, {}), {
    ok: true, value: { state: 'ok', httpStatus: 200, latencyMs: 12 },
  });

  for (const payload of [
    {}, { enabled: 'yes' }, { endpoint: 'ftp://jev.example/v1' },
    { endpoint: 'https://jev.example/v1', extra: true }, { unknown: true },
  ]) {
    assert.equal((await rpc(SET_ROUTER_SETTINGS_ENDPOINT, payload)).error.code, 'bad-request', JSON.stringify(payload));
  }
});

test('router settings persist with owner-only permissions and recover from a damaged file', async (t) => {
  const { config, keyPath } = await fixture(t);
  const settings = createRouterSettingsStore(config);
  assert.deepEqual(settings.get(), { version: 1, enabled: false, endpoint: DEFAULT_JEV_ENDPOINT });
  await settings.load();
  await settings.update({ enabled: true, endpoint: 'https://jev.example/v1' });
  const path = routerSettingsPath(config);
  assert.equal(join(keyPath, '..'), join(path, '..'));
  assert.equal((await stat(path)).mode & 0o777, 0o600);

  const reloaded = createRouterSettingsStore(config);
  await reloaded.load();
  assert.deepEqual(reloaded.get(), { version: 1, enabled: true, endpoint: 'https://jev.example/v1' });
  await assert.rejects(reloaded.update({ endpoint: 'file:///etc/passwd' }), TypeError);

  await writeFile(path, '{not-json');
  const recovered = createRouterSettingsStore(config, { enabled: true });
  await recovered.load();
  assert.deepEqual(recovered.get(), { version: 1, enabled: true, endpoint: DEFAULT_JEV_ENDPOINT });
});

test('Jev service probe reports health without leaking the key or response body', async () => {
  assert.deepEqual(await testJevService({ apiKey: '' }), { state: 'missing-key', latencyMs: 0 });

  const calls = [];
  const ok = await testJevService({
    endpoint: 'https://jev.example/v1',
    apiKey: 'synthetic-key',
    fetchImpl: async (url, options) => {
      calls.push([url, options]);
      return new Response('{"answers":{}}', { status: 200 });
    },
  });
  assert.deepEqual(ok.state, 'ok');
  assert.equal(calls[0][0], 'https://jev.example/v1');
  assert.equal(calls[0][1].headers.authorization, 'Bearer synthetic-key');
  const body = JSON.parse(calls[0][1].body);
  assert.equal(body.questions.route.type, 'choice');
  assert.deepEqual(Object.keys(body.questions.route.criteria), ['continue', 'switch']);
  assert.doesNotMatch(JSON.stringify(ok), /synthetic-key|answers/u);

  const status = (code) => testJevService({
    apiKey: 'synthetic-key', fetchImpl: async () => new Response('', { status: code }),
  });
  assert.equal((await status(401)).state, 'auth-failed');
  assert.equal((await status(500)).state, 'http-error');

  const timeout = await testJevService({
    apiKey: 'synthetic-key',
    fetchImpl: async () => { throw Object.assign(new Error('slow'), { name: 'TimeoutError' }); },
  });
  assert.equal(timeout.state, 'timeout');
  const unreachable = await testJevService({
    apiKey: 'synthetic-key',
    fetchImpl: async () => { throw new Error('offline'); },
  });
  assert.equal(unreachable.state, 'unreachable');
});
