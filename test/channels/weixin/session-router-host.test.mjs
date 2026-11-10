import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { inject as weixinHostInject } from '../../../plugin-src/host/channels/weixin/index.mjs';
import { createWeixinSessionRouter } from '../../../plugin-src/host/channels/weixin/session-router.mjs';

test('Weixin plugin declares the Host services used by session routing', () => {
  assert.ok(weixinHostInject.includes('sessionQuery'));
  assert.ok(weixinHostInject.includes('llm'));
});

test('default recall uses the injected model and lists archived sessions once', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-weixin-router-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const classifyEntry = join(directory, 'classify.mjs');
  const indexPath = join(directory, 'index.jsonl');
  await writeFile(classifyEntry, "process.stdout.write('true');\n");
  await writeFile(indexPath, [
    { key: 'p2p:wx-user', sessionId: 'old-one' },
    { key: 'p2p:wx-user', sessionId: 'old-two' },
  ].map((record) => JSON.stringify(record)).join('\n') + '\n');

  const workspaceCalls = [];
  const searches = [];
  const ctx = {
    sessionQuery: {
      async readSession() { return { events: [] }; },
      async readTitle(sessionId) { return { title: sessionId }; },
      async searchSessions(query) {
        searches.push(query);
        return { items: ['old-one', 'old-two'].map((id) => ({
          header: { id }, bestMatch: { snippet: `${id} excerpt` },
        })) };
      },
    },
    llm: {
      async prepareCall(config) {
        assert.equal(config.maxTokens, 128);
        return {
          config: {},
          async *stream() {
            yield { type: 'text-delta', text: '"old-two"' };
            yield { type: 'finish', reason: { kind: 'stop' } };
          },
        };
      },
    },
  };
  const harness = {
    async rpc(...args) {
      workspaceCalls.push(args);
      return { archivedSessionIds: [] };
    },
  };
  const route = createWeixinSessionRouter(ctx, {
    classifyEntry,
    recallModel: { provider: 'test', model: 'test-model' },
  }, indexPath, harness);

  assert.deepEqual(await route({
    text: '继续报销流程', key: 'p2p:wx-user', current: 'current',
  }), { action: 'resume', sessionId: 'old-two', title: 'old-two' });
  assert.equal(workspaceCalls.length, 1);
  assert.deepEqual(workspaceCalls[0].slice(0, 3), ['workspace.list', {}, 30_000]);
  assert.equal(searches.length, 1);
  assert.deepEqual(searches[0].sessionFilters, [{ kind: 'id', values: ['old-one', 'old-two'] }]);
});

test('a disabled smart-routing switch keeps the current session without running the classifier', async () => {
  const route = createWeixinSessionRouter({}, { classifyEntry: '/does/not/exist' }, '/does/not/exist.jsonl', {}, {
    get: () => ({ enabled: false, endpoint: 'https://jev.example/v1/classify' }),
  });
  assert.deepEqual(await route({
    text: '继续昨天的报销流程', key: 'p2p:wx-user', current: 'current',
  }), { action: 'keep' });
});

test('the saved Jev endpoint reaches the classifier process', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-weixin-router-endpoint-'));
  const previousCapture = process.env.DSH_IM_JEV_CAPTURE;
  t.after(async () => {
    if (previousCapture === undefined) delete process.env.DSH_IM_JEV_CAPTURE;
    else process.env.DSH_IM_JEV_CAPTURE = previousCapture;
    await rm(directory, { recursive: true, force: true });
  });
  const capture = join(directory, 'endpoint.txt');
  const classifyEntry = join(directory, 'classify.mjs');
  await writeFile(classifyEntry, [
    "import { writeFileSync } from 'node:fs';",
    "writeFileSync(process.env.DSH_IM_JEV_CAPTURE, process.env.DSH_IM_JEV_ENDPOINT ?? '');",
    "process.stdout.write('false');",
  ].join('\n'));
  process.env.DSH_IM_JEV_CAPTURE = capture;
  const ctx = {
    sessionQuery: {
      async readSession() { return { events: [] }; },
      async readTitle() { return { title: '' }; },
    },
  };
  const route = createWeixinSessionRouter(ctx, { classifyEntry }, join(directory, 'index.jsonl'), {}, {
    get: () => ({ enabled: true, endpoint: 'https://jev.example/v1/classify' }),
  });
  assert.deepEqual(await route({
    text: '继续昨天的报销流程', key: 'p2p:wx-user', current: 'current',
  }), { action: 'keep' });
  assert.equal(await readFile(capture, 'utf8'), 'https://jev.example/v1/classify');
});
