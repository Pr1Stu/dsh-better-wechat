import test from 'node:test';
import { spawnSync } from 'node:child_process';import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { decideWeixinSession, recallKeywords } from '../../../src/channels/weixin/session-router.mjs';

const route = {
  text: '继续昨天的报销流程',
  current: 'current',
  readContext: async (_id, count) => ({ turns: Array(count).fill({}) }),
  classify: async () => true,
  search: async () => [{ sessionId: 'older' }],
  recall: async () => 'older',
};

test('requests more context within the same classification deadline', async () => {
  const counts = [];
  const signals = new Set();
  const result = await decideWeixinSession({
    ...route,
    classify: async ({ turns }, signal) => {
      counts.push(turns.length);
      signals.add(signal);
      return turns.length === 3 ? true : null;
    },
  });
  assert.deepEqual(counts, [1, 2, 3]);
  assert.equal(signals.size, 1);
  assert.deepEqual(result, { action: 'resume', sessionId: 'older' });
});

test('keeps the current session on uncertain or failed classification', async () => {
  for (const classify of [async () => null, async () => { throw new Error('offline'); }]) {
    assert.deepEqual(await decideWeixinSession({ ...route, classify }), { action: 'keep' });
  }
});

test('opens a session on missing matches and rejects invented candidates', async () => {
  assert.deepEqual(await decideWeixinSession({ ...route, recall: async () => null }), { action: 'new' });
  assert.deepEqual(await decideWeixinSession({ ...route, recall: async () => 'foreign' }),
    { action: 'new', recallFailed: true });
});

test('extracts Chinese search terms without conversational filler', () => {
  assert.match(recallKeywords(route.text), /报销/);
  assert.equal(recallKeywords('继续上次那个'), '');
});

test('route diagnostics distinguish classification failures from confirmed continuations', async () => {
  const events = [];
  const trace = (event) => events.push(event);
  await decideWeixinSession({ ...route, trace, classify: async () => false });
  assert.deepEqual(events.pop(), { action: 'keep', reason: 'classified-continue' });
  await decideWeixinSession({ ...route, trace, readContext: async () => { throw new Error('private'); } });
  assert.deepEqual(events.slice(-2), [
    { stage: 'context', round: 1, failure: 'error' },
    { action: 'keep', reason: 'context-failed' },
  ]);
  assert.doesNotMatch(JSON.stringify(events), /private|报销/);
});

test('Jev worker consumes piped JSON before checking credentials', () => {
  const worker = new URL('../../../examples/weixin-router/jev-classify.mjs', import.meta.url);
  const result = spawnSync(process.execPath, [fileURLToPath(worker)], {
    input: '{"text":"synthetic test","turns":[]}',
    encoding: 'utf8',
    env: { ...process.env, DSH_IM_JEV_ROUTE_ID: 'test', DSH_IM_JEV_KEY_FILE: '/dev/null' },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /jev-error credentials /);
  assert.equal(result.stdout, '');
});

test('explicit new conversation skips retrieval and bypasses the next route', async () => {
  const result = await decideWeixinSession({
    ...route,
    classify: async () => '/new',
    search: async () => assert.fail('explicit new conversation must not search'),
  });
  assert.deepEqual(result, { action: 'new', skipNextRoute: true });
});
