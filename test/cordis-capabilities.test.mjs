import assert from 'node:assert/strict';
import test from 'node:test';

import {
  inject as hostInject,
  provide as hostProvide,
} from '../plugin-src/host/index.mjs';
import {
  inject as clientInject,
  provide as clientProvide,
} from '../plugin-src/client/index.js';
import { inject as manualInject } from '../examples/sim-weixin/manual-host.mjs';

const CONTEXT_METHODS = ['effect', 'on', 'provide', 'get', 'logger', 'root', 'inject', 'emit'];

function declared(list) {
  assert.ok(Array.isArray(list));
  assert.equal(new Set(list).size, list.length, 'declarations must be unique');
  for (const name of list) assert.equal(CONTEXT_METHODS.includes(name), false, `${name} is a context API`);
}

test('published plugins declare the services they consume and provide', () => {
  declared(hostInject);
  declared(clientInject);
  declared(manualInject);
  declared(hostProvide);
  declared(clientProvide);

  for (const service of ['connection', 'credentials', 'typertGateway', 'sessionQuery', 'llm']) {
    assert.ok(hostInject.includes(service), `Host must inject ${service}`);
  }
  assert.deepEqual(hostProvide, ['dshIm']);
  for (const service of ['slots', 'connection', 'locale', 'workspaces']) {
    assert.ok(clientInject.includes(service), `client must inject ${service}`);
  }
  assert.deepEqual(clientProvide, ['dshImClient']);
  for (const service of ['sessionQuery', 'llm', 'connection', 'typertGateway']) {
    assert.ok(manualInject.includes(service), `manual access point must inject ${service}`);
  }
});
