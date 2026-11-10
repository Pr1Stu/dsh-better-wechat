import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildList, installChannelListRpc } from '../plugin-src/host/channel-list-rpc.mjs';

async function temporaryHome(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-im-channel-list-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function putWeixinState(root, accountId, value) {
  const directory = join(root, 'integrations', 'dsh-weixin', 'accounts', accountId);
  await mkdir(directory, { recursive: true });
  const path = join(directory, 'state.json');
  await writeFile(path, typeof value === 'string' ? value : JSON.stringify(value));
  return path;
}

test('buildList exposes only Weixin account sessions and reports damaged state files', async t => {
  const root = await temporaryHome(t);
  await putWeixinState(root, 'wx-account', {
    sessions: { 'direct:wx-user': 'session-weixin', ignored: '' },
  });
  const damaged = await putWeixinState(root, 'broken-account', '{not-json');

  const result = await buildList({ dshHome: root });
  assert.deepEqual(result.channels, [{ channel: 'weixin', sessions: [{
    key: 'direct:wx-user', sessionId: 'session-weixin', botId: 'wx-account',
  }] }]);
  assert.equal(result.scannedFiles, 1);
  assert.match(result.warnings[0], /^dsh-weixin\/accounts\/broken-account\/state\.json:/);
  assert.equal(result.warnings.length, 1);
  assert.equal(await readFile(damaged, 'utf8'), '{not-json');
});

test('buildList returns an empty directory when integrations do not exist', async t => {
  const root = await temporaryHome(t);
  assert.deepEqual(await buildList({ dshHome: root }), { channels: [], scannedFiles: 0, warnings: [] });
});

test('list.channels returns its payload in the connection RPC value field', async t => {
  const root = await temporaryHome(t);
  await putWeixinState(root, 'wx-account', { sessions: { 'direct:wx-user': 'session-weixin' } });
  let fetch;
  const ctx = { connection: { fetch: { register(definition) {
    fetch = definition.fetch;
    return () => {};
  } } } };
  installChannelListRpc(ctx, undefined, { dshHome: root });

  const response = await fetch(new Request('http://127.0.0.1/api/dsh-im/dsh-im-channels', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request', rpcId: 'rpc-test', method: 'dsh-im/dsh-im-channels',
      payload: { method: 'list.channels', payload: {} },
    }),
  }));
  const envelope = await response.json();
  assert.equal(response.status, 200);
  assert.equal(envelope.result.ok, true);
  assert.deepEqual(envelope.result.value.channels.map(group => group.channel), ['weixin']);
  assert.equal(Object.hasOwn(envelope.result, 'data'), false);
});

test('session.read returns only the bound append-origin human transcript', async t => {
  const root = await temporaryHome(t);
  await putWeixinState(root, 'wx-account', { sessions: { 'direct:wx-user': 'session-weixin' } });
  const reads = [];
  const events = [
    { type: 'user/message', seq: 0, time: 100, surfaceOp: 'append', data: {
      source: { kind: 'user' }, content: [{ type: 'text', text: '第一条用户消息' }],
    } },
    { type: 'user/message', seq: 1, time: 101, surfaceOp: 'append', data: {
      source: { kind: 'plugin:memory' }, content: [{ type: 'text', text: '内部记忆不得显示' }],
    } },
    { type: 'assistant/message', seq: 2, time: 102, surfaceOp: 'append', data: { message: {
      role: 'assistant', content: [
        { type: 'reasoning', text: '内部推理不得显示' },
        { type: 'text', text: '第一条助手回复' },
      ],
    } } },
    { type: 'assistant/message', seq: 3, time: 103, surfaceOp: { replace: [2] }, data: { message: {
      role: 'assistant', content: [{ type: 'text', text: '替换副本不得覆盖历史' }],
    } } },
  ];
  let fetch;
  const sessionQuery = { async readSession(sessionId) {
    reads.push(sessionId);
    return { session: { id: sessionId, createdAt: 90 }, events };
  } };
  const ctx = {
    inject(dependencies, callback) {
      assert.deepEqual(dependencies, ['sessionQuery']);
      callback({ sessionQuery });
      return { dispose() {} };
    },
    connection: { fetch: { register(definition) {
      fetch = definition.fetch;
      return () => {};
    } } },
  };
  installChannelListRpc(ctx, undefined, { dshHome: root });

  const call = payload => fetch(new Request('http://127.0.0.1/api/dsh-im/dsh-im-channels', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'rpc-test',
      method: 'dsh-im/dsh-im-channels', payload: { method: 'session.read', payload } }),
  }));
  const response = await call({ channel: 'weixin', key: 'direct:wx-user',
    botId: 'wx-account', sessionId: 'session-weixin' });
  const result = (await response.json()).result;
  assert.equal(result.ok, true);
  assert.deepEqual(reads, ['session-weixin']);
  assert.deepEqual(result.value.messages.map(({ role, text }) => [role, text]), [
    ['user', '第一条用户消息'], ['assistant', '第一条助手回复'],
  ]);

  const denied = (await (await call({ channel: 'telegram', key: 'direct:wx-user',
    botId: 'wx-account', sessionId: 'session-weixin' })).json()).result;
  assert.equal(denied.error.code, 'channel-session/not-bound');
  assert.deepEqual(reads, ['session-weixin']);
});
