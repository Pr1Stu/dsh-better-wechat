import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDeliveryAdapter,
  normalizeDeliveryTarget,
  supportsDeliveryChannel,
} from '../plugin-src/host/delivery-adapter.mjs';

test('Weixin is the only delivery adapter', () => {
  assert.equal(supportsDeliveryChannel('weixin'), true);
  for (const channel of ['feishu', 'telegram', 'matrix', 'qq', 'email', 'unknown']) {
    assert.equal(supportsDeliveryChannel(channel), false);
    assert.throws(() => createDeliveryAdapter({ channel }), TypeError);
  }
});

test('Weixin targets accept only a named user route', () => {
  assert.deepEqual(normalizeDeliveryTarget('weixin', {
    targetId: 'release-alerts', name: ' Release alerts ', kind: 'user',
    route: { toUserId: 'wx-user' },
  }), {
    targetId: 'release-alerts', name: 'Release alerts', kind: 'user',
    route: { toUserId: 'wx-user' },
  });
  for (const target of [
    { targetId: 'group', kind: 'group', route: { toUserId: 'wx-user' } },
    { targetId: 'extra', kind: 'user', route: { toUserId: 'wx-user', sessionId: 'unstable' } },
  ]) {
    assert.throws(() => normalizeDeliveryTarget('weixin', target), { code: 'invalid-target' });
  }
});

test('suggestions and proactive sends use the persisted Weixin user ID', async () => {
  const sent = [];
  const target = { targetId: 'release-alerts', kind: 'user', route: { toUserId: 'wx-user' } };
  const adapter = createDeliveryAdapter({
    channel: 'weixin',
    workspaces: {
      has: (botId) => botId === 'bot-weixin',
      listDeliveryTargets: () => [target],
    },
    coreController: { async sendProactiveText(...args) { sent.push(args); } },
    stateFor: async () => ({ snapshot: () => ({ sessions: {
      'p2p:wx-user': 'session-one', 'group:ignored': 'session-two',
    } }) }),
  });

  assert.equal(adapter.ownsBot('bot-weixin'), true);
  assert.deepEqual(await adapter.listSuggestions('bot-weixin'), [
    { kind: 'user', route: { toUserId: 'wx-user' } },
  ]);
  assert.deepEqual(await adapter.sendText('bot-weixin', target, 'Build finished.'), { sent: true });
  assert.deepEqual(sent, [['bot-weixin', target, 'Build finished.', {}]]);
});
