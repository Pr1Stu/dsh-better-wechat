import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BOT_SETTINGS_TABS,
  DELIVERY_CHANNEL_DEFINITIONS,
  DELIVERY_ENDPOINTS,
} from '../plugin-src/client/delivery-settings.js';
import { ACCESS_CHANNEL_DEFINITIONS } from '../plugin-src/client/access-policy-settings.js';

test('delivery and access settings expose only Weixin capabilities', () => {
  assert.deepEqual(Object.keys(DELIVERY_CHANNEL_DEFINITIONS), ['weixin']);
  assert.deepEqual(DELIVERY_CHANNEL_DEFINITIONS.weixin.kinds, [{ value: 'user', label: '用户' }]);
  assert.deepEqual(DELIVERY_CHANNEL_DEFINITIONS.weixin.fields.user.map(({ key }) => key), ['toUserId']);
  assert.deepEqual(Object.keys(ACCESS_CHANNEL_DEFINITIONS), ['weixin']);
  assert.equal(ACCESS_CHANNEL_DEFINITIONS.weixin.groupSupported, false);
  assert.deepEqual(BOT_SETTINGS_TABS.map(({ id }) => id), ['general', 'delivery', 'ds-bot', 'access']);
  assert.deepEqual(DELIVERY_ENDPOINTS, {
    list: 'target.list',
    listSuggestions: 'target.suggestion.list',
    create: 'target.create',
    update: 'target.update',
    delete: 'target.delete',
    sessionSync: 'target.session-sync.set',
    test: 'target.test',
  });
});
