import assert from 'node:assert/strict';
import test from 'node:test';

import {
  conversationKeyMatchesTarget,
  deliverySuggestionFromConversationKey,
  privateConversationKeyMatchesTarget,
  privateDeliverySuggestionFromConversationKey,
  resolveConversationKey,
  resolvePrivateConversationKey,
} from '../plugin-src/host/delivery-suggestions.mjs';

const PRIVATE_TARGET = { kind: 'user', route: { toUserId: 'wx-user' } };

test('a weixin private key matches only its own target', () => {
  assert.deepEqual(deliverySuggestionFromConversationKey('weixin', 'p2p:wx-user'), PRIVATE_TARGET);
  assert.deepEqual(privateDeliverySuggestionFromConversationKey('weixin', 'p2p:wx-user'), PRIVATE_TARGET);
  assert.equal(conversationKeyMatchesTarget('weixin', 'p2p:wx-user', PRIVATE_TARGET), true);
  assert.equal(privateConversationKeyMatchesTarget('weixin', 'p2p:wx-user', PRIVATE_TARGET), true);
  assert.equal(conversationKeyMatchesTarget('weixin', 'p2p:wx-user', {
    ...PRIVATE_TARGET, targetId: 'daily', name: 'Daily',
  }), true, 'targetId and name are not part of the route identity');
  assert.equal(conversationKeyMatchesTarget('weixin', 'p2p:other', PRIVATE_TARGET), false);
  assert.equal(conversationKeyMatchesTarget('weixin', 'p2p:wx-user', {
    kind: 'user', route: { toUserId: 'other' },
  }), false);
  assert.equal(deliverySuggestionFromConversationKey('weixin', 'group:wx-user'), null);
  assert.equal(privateDeliverySuggestionFromConversationKey('weixin', 'group:wx-user'), null);
});

test('Session sync resolves the one matching private key and ignores other channels', () => {
  const sessions = { 'p2p:wx-user': 'session-private', 'p2p:other': 'session-other' };
  assert.equal(resolveConversationKey('weixin', sessions, PRIVATE_TARGET), 'p2p:wx-user');
  assert.equal(resolvePrivateConversationKey('weixin', sessions, PRIVATE_TARGET), 'p2p:wx-user');
  assert.equal(resolveConversationKey('weixin', { 'group:wx-user': 'session-group' }, PRIVATE_TARGET), null);
  assert.equal(resolveConversationKey('weixin', {}, PRIVATE_TARGET), null);
  assert.equal(resolveConversationKey('weixin', null, PRIVATE_TARGET), null);
  assert.equal(resolveConversationKey('telegram', sessions, PRIVATE_TARGET), null);
});
