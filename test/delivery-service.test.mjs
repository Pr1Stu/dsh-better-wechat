import assert from 'node:assert/strict';
import test from 'node:test';

import { createDeliveryAdapter } from '../plugin-src/host/delivery-adapter.mjs';
import { createDeliveryService } from '../plugin-src/host/delivery-service.mjs';

function memoryAdapter({ channel = 'weixin', botId = 'bot_one' } = {}) {
  const targets = new Map();
  const sends = [];
  return {
    channel,
    sends,
    listBots: () => [botId],
    ownsBot: (candidate) => candidate === botId,
    listTargets: () => [...targets.values()].map((target) => structuredClone(target)),
    listSuggestions: () => [{ kind: 'user', route: { toUserId: '123' } }],
    async createTarget(_botId, target) {
      if (targets.has(target.targetId)) {
        const error = new Error('duplicate');
        error.code = 'target-conflict';
        throw error;
      }
      targets.set(target.targetId, structuredClone(target));
      return structuredClone(target);
    },
    async updateTarget(_botId, targetId, replacement) {
      if (!targets.has(targetId)) {
        const error = new Error('missing');
        error.code = 'unknown-target';
        throw error;
      }
      const target = { targetId, ...structuredClone(replacement) };
      targets.set(targetId, target);
      return structuredClone(target);
    },
    async deleteTarget(_botId, targetId) {
      if (!targets.delete(targetId)) {
        const error = new Error('missing');
        error.code = 'unknown-target';
        throw error;
      }
    },
    async sendText(...args) { sends.push(args); },
  };
}

test('DeliveryService shares target CRUD and sending through one adapter', async () => {
  const service = createDeliveryService();
  const adapter = memoryAdapter();
  service.registerAdapter(adapter);
  const target = {
    targetId: 'daily-report',
    name: 'Daily report',
    kind: 'user',
    route: { toUserId: '123' },
  };

  assert.deepEqual(await service.createTarget('bot_one', target), target);
  assert.deepEqual(await service.listTargets('bot_one'), {
    botId: 'bot_one',
    channel: 'weixin',
    targets: [{
      ...target,
      sessionSync: { enabled: false, state: 'unavailable' },
    }],
  });
  assert.deepEqual(await service.listBots(), [{ botId: 'bot_one', channel: 'weixin' }]);
  assert.deepEqual(await service.listSuggestions('bot_one'), {
    botId: 'bot_one',
    channel: 'weixin',
    suggestions: [{ kind: 'user', route: { toUserId: '123' } }],
  });
  assert.deepEqual(await service.updateTarget('bot_one', 'daily-report', {
    name: 'New target',
    kind: 'user',
    route: { toUserId: '456' },
  }), {
    targetId: 'daily-report',
    name: 'New target',
    kind: 'user',
    route: { toUserId: '456' },
  });

  const signal = new AbortController().signal;
  assert.deepEqual(
    await service.send('bot_one', 'daily-report', 'keep original whitespace\n', { signal }),
    { sent: true },
  );
  assert.deepEqual(adapter.sends, [[
    'bot_one',
    {
      targetId: 'daily-report',
      name: 'New target',
      kind: 'user',
      route: { toUserId: '456' },
    },
    'keep original whitespace\n',
    { signal },
  ]]);
  assert.deepEqual(await service.deleteTarget('bot_one', 'daily-report'), { deleted: true });
  await assert.rejects(service.send('bot_one', 'daily-report', 'missing'), { code: 'unknown-target' });
});

test('DeliveryService validates public ids, text, cancellation, and unknown bots', async () => {
  const service = createDeliveryService();
  service.registerAdapter(memoryAdapter());
  await assert.rejects(service.listTargets('../bot'), { code: 'bad-request' });
  await assert.rejects(service.listSuggestions('../bot'), { code: 'bad-request' });
  await assert.rejects(service.listTargets('bot_missing'), { code: 'unknown-bot' });
  await assert.rejects(service.listSuggestions('bot_missing'), { code: 'unknown-bot' });
  await assert.rejects(service.send('bot_one', 'bad target', 'hello'), { code: 'bad-request' });
  await assert.rejects(service.send('bot_one', 'target', '   '), { code: 'bad-request' });
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(service.send('bot_one', 'target', 'hello', { signal: abort.signal }), {
    code: 'cancelled',
  });
  await assert.rejects(
    service.updateTarget('bot_one', 'target', {
      targetId: 'renamed', kind: 'user', route: { toUserId: '1' },
    }),
    { code: 'bad-request' },
  );
});

test('DeliveryService tests a validated draft route without reading or persisting targets', async () => {
  const service = createDeliveryService();
  const workspaceCalls = [];
  const sends = [];
  service.registerAdapter(createDeliveryAdapter({
    channel: 'weixin',
    workspaces: {
      has: (botId) => botId === 'bot_one',
      listDeliveryTargets: (...args) => workspaceCalls.push(['list', ...args]),
      createDeliveryTarget: (...args) => workspaceCalls.push(['create', ...args]),
      updateDeliveryTarget: (...args) => workspaceCalls.push(['update', ...args]),
      deleteDeliveryTarget: (...args) => workspaceCalls.push(['delete', ...args]),
    },
    coreController: {
      async sendProactiveText(...args) { sends.push(args); },
    },
    stateFor: async () => ({ snapshot: () => ({ sessions: {} }) }),
  }));
  const signal = new AbortController().signal;
  const draft = { kind: 'user', route: { toUserId: 'wx-user' } };

  assert.deepEqual(
    await service.send('bot_one', draft, 'draft test', { signal }),
    { sent: true },
  );
  assert.deepEqual(workspaceCalls, []);
  assert.deepEqual(sends, [[
    'bot_one',
    { targetId: '__test__', ...draft },
    'draft test',
    { signal },
  ]]);
  assert.deepEqual(draft, {
    kind: 'user',
    route: { toUserId: 'wx-user' },
  });

  await assert.rejects(
    service.send('bot_one', { ...draft, targetId: 'must-not-participate' }, 'draft test'),
    { code: 'bad-request' },
  );
  await assert.rejects(
    service.send('bot_one', { ...draft, name: 'must-not-participate' }, 'draft test'),
    { code: 'bad-request' },
  );
  await assert.rejects(
    service.send('bot_one', {
      kind: 'user', route: { toUserId: '' },
    }, 'draft test'),
    { code: 'invalid-target' },
  );
  assert.deepEqual(workspaceCalls, []);
  assert.equal(sends.length, 1);
});

test('a Session delivery follows the binding instead of a configured target', async () => {
  const warnings = [];
  const service = createDeliveryService({ logger: { warn: (line) => warnings.push(line) } });
  const sends = [];
  service.registerAdapter(createDeliveryAdapter({
    channel: 'weixin',
    workspaces: {
      has: (botId) => botId === 'bot_one',
      listBotIds: () => ['bot_one'],
      listDeliveryTargets: () => [],
      listSessionSyncTargets: () => [],
    },
    coreController: {
      async sendProactiveText(...args) { sends.push(args); },
    },
    stateFor: async () => ({
      snapshot: () => ({
        sessions: {
          'p2p:777': 'session-direct',
          // A key the channel can persist but no delivery route covers.
          'unroutable-key': 'session-unroutable',
          // A malformed private key must never be guessed into a recipient.
          'p2p:777:42': 'session-legacy',
        },
      }),
    }),
  }));

  assert.deepEqual(await service.deliverSessionText('session-direct', 'direct text', { format: 'markdown' }), { sent: true });
  assert.deepEqual(sends, [[
    'bot_one',
    {
      targetId: '__test__',
      kind: 'user',
      route: { toUserId: '777' },
    },
    'direct text',
    { signal: undefined, format: 'markdown' },
  ]]);

  // Nowhere to go is a result, not a failure, but it is never silent: the log
  // names the Session, the channel and the key, and never the body itself.
  const body = 'body that must not be logged';
  assert.deepEqual(await service.deliverSessionText('session-unbound', body), {
    sent: false,
    reason: 'unbound',
  });
  assert.deepEqual(await service.deliverSessionText('session-unroutable', body), {
    sent: false,
    reason: 'unroutable',
  });
  assert.deepEqual(await service.deliverSessionText('session-legacy', body), {
    sent: false,
    reason: 'unroutable',
  });
  assert.equal(sends.length, 1, 'no unroutable key reached a chat');
  assert.deepEqual(warnings, [
    '[dsh-im] Session text was not delivered [unbound] session=session-unbound',
    '[dsh-im] Session text was not delivered [unroutable] session=session-unroutable'
      + ' channel=weixin conversationKey=unroutable-key',
    '[dsh-im] Session text was not delivered [unroutable] session=session-legacy'
      + ' channel=weixin conversationKey=p2p:777:42',
  ]);
  assert.doesNotMatch(warnings.join('\n'), /body that must not be logged/);

  await assert.rejects(service.deliverSessionText('', 'text'), { code: 'bad-request' });
  await assert.rejects(service.deliverSessionText('session-direct', '   '), { code: 'bad-request' });
  await assert.rejects(service.deliverSessionText('session-direct', 'text', { format: 'html' }), {
    code: 'bad-request',
  });
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(service.deliverSessionText('session-direct', 'text', { signal: abort.signal }), {
    code: 'cancelled',
  });
  assert.equal(sends.length, 1);
});

test('deliverSessionText resolves a rolled-over DS Bot session through dsBot.status()', async () => {
  const service = createDeliveryService({
    dsBot: { status: async () => ({ state: 'ready', bots: [{ id: 'dsbot-1', name: 'Bot', sessionId: 'session-rolled' }] }) },
  });
  const sends = [];
  service.registerAdapter(createDeliveryAdapter({
    channel: 'weixin',
    workspaces: {
      has: (botId) => botId === 'bot_one',
      listBotIds: () => ['bot_one'],
      listDeliveryTargets: () => [],
      listSessionSyncTargets: () => [],
      listDsBotBindings: () => [{ botId: 'bot_one', conversationKey: 'p2p:777', dsBotId: 'dsbot-1' }],
    },
    coreController: {
      async sendProactiveText(...args) { sends.push(args); },
    },
    stateFor: async () => ({ snapshot: () => ({ sessions: {} }) }),
  }));

  assert.deepEqual(await service.deliverSessionText('session-rolled', 'answer'), { sent: true });
  assert.deepEqual(sends, [[
    'bot_one',
    { targetId: '__test__', kind: 'user', route: { toUserId: '777' } },
    'answer',
    { signal: undefined },
  ]]);
});

test('DeliveryService revalidates suggestions before exposing adapter output', async () => {
  const service = createDeliveryService();
  const adapter = memoryAdapter();
  service.registerAdapter(adapter);

  adapter.listSuggestions = () => [{

    kind: 'chat',
    route: { chatId: '123' },
    sessionId: 'secret-session',
  }];
  await assert.rejects(service.listSuggestions('bot_one'), { code: 'invalid-target' });

  adapter.listSuggestions = () => [{
    kind: 'chat',
    route: { chatId: '123', replyTarget: 'secret-reply' },
  }];
  await assert.rejects(service.listSuggestions('bot_one'), { code: 'invalid-target' });
});

test('DeliveryService maps an adapter abort to cancelled', async () => {
  const service = createDeliveryService();
  const adapter = memoryAdapter();
  adapter.sendText = async () => {
    const error = new Error('aborted downstream');
    error.name = 'AbortError';
    throw error;
  };
  service.registerAdapter(adapter);
  await service.createTarget('bot_one', {
    targetId: 'target', kind: 'chat', route: { chatId: 1 },
  });
  await assert.rejects(service.send('bot_one', 'target', 'hello'), { code: 'cancelled' });
});

test('DeliveryService adapter replacement has stale-safe unregister semantics', async () => {
  const service = createDeliveryService();
  const first = memoryAdapter();
  const second = memoryAdapter();
  const unregisterFirst = service.registerAdapter(first);
  const unregisterSecond = service.registerAdapter(second);
  assert.equal(unregisterFirst(), false);
  await service.createTarget('bot_one', {
    targetId: 'current', kind: 'chat', route: { chatId: 1 },
  });
  assert.equal((await service.listTargets('bot_one')).targets.length, 1);
  assert.equal(unregisterSecond(), true);
  await assert.rejects(service.listTargets('bot_one'), { code: 'unknown-bot' });
});

test('DeliveryService exposes and revalidates local Session sync without changing public send', async () => {
  const service = createDeliveryService();
  const adapter = memoryAdapter();
  const syncCalls = [];
  adapter.listTargets = () => [{
    targetId: 'direct', kind: 'chat', route: { chatId: '123' },
    sessionSync: { enabled: false, state: 'off' },
  }];
  adapter.setSessionSync = async (...args) => {
    syncCalls.push(['set', ...args]);
    return { enabled: args[2], state: args[2] ? 'active' : 'off' };
  };
  adapter.listSessionSyncTargets = async (sessionId) => (
    sessionId === 'session-one' ? [{ botId: 'bot_one', targetId: 'direct' }] : []
  );
  adapter.sendSessionSyncText = async (...args) => syncCalls.push(['send', ...args]);
  service.registerAdapter(adapter);

  assert.deepEqual((await service.listTargets('bot_one')).targets[0].sessionSync, {
    enabled: false, state: 'off',
  });
  assert.deepEqual(await service.setSessionSync('bot_one', 'direct', true), {
    enabled: true, state: 'active',
  });
  assert.deepEqual(await service.listSessionSyncTargets('session-one'), [{
    channel: 'weixin', botId: 'bot_one', targetId: 'direct',
  }]);
  assert.deepEqual(
    await service.sendSessionSyncText('bot_one', 'direct', 'session-one', 'hello'),
    { sent: true },
  );
  assert.deepEqual(syncCalls, [
    ['set', 'bot_one', 'direct', true],
    ['send', 'bot_one', 'direct', 'session-one', 'hello', { signal: undefined, format: 'plain' }],
  ]);
  const signal = new AbortController().signal;
  await service.sendSessionSyncText('bot_one', 'direct', 'session-one', '**answer**', { signal, format: 'markdown' });
  assert.deepEqual(syncCalls.at(-1), ['send', 'bot_one', 'direct', 'session-one', '**answer**', { signal, format: 'markdown' }]);
  const sent = syncCalls.length;
  for (const format of ['html', '', null, false]) {
    await assert.rejects(service.sendSessionSyncText('bot_one', 'direct', 'session-one', 'answer', { format }), { code: 'bad-request' });
  }
  await assert.rejects(service.sendSessionSyncText('bot_one', 'direct', 'session-one', 'answer', {
    format: 'markdown', signal: AbortSignal.abort(),
  }), { code: 'cancelled' });
  assert.equal(syncCalls.length, sent);
});

test('DeliveryService marks explicit remote Harness channels unavailable for Session sync', async () => {
  const service = createDeliveryService({ unavailableSessionSyncChannels: ['weixin'] });
  const adapter = memoryAdapter();
  const calls = [];
  adapter.listTargets = () => [{
    targetId: 'direct', kind: 'chat', route: { chatId: '123' },
    sessionSync: { enabled: true, state: 'active' },
  }];
  adapter.setSessionSync = async (...args) => {
    calls.push(args);
    return { enabled: false, state: 'off' };
  };
  adapter.listSessionSyncTargets = async () => [{ botId: 'bot_one', targetId: 'direct' }];
  adapter.sendSessionSyncText = async () => {};
  service.registerAdapter(adapter);

  assert.deepEqual((await service.listTargets('bot_one')).targets[0].sessionSync, {
    enabled: true, state: 'unavailable',
  });
  await assert.rejects(service.setSessionSync('bot_one', 'direct', true), {
    code: 'session-sync-unavailable',
  });
  assert.deepEqual(await service.listSessionSyncTargets('session-one'), []);
  assert.deepEqual(await service.setSessionSync('bot_one', 'direct', false), {
    enabled: false, state: 'off',
  });
  assert.deepEqual(calls, [['bot_one', 'direct', false]]);
});

function checkedFixture() {
  const service = createDeliveryService();
  const adapter = memoryAdapter({channel: 'weixin'});
  const fingerprint = 'a'.repeat(64);
  adapter.describeAccount = async () => ({version: 1, botId: 'bot_one', channel: 'weixin',
    connected: true, capabilities: ['proactive-text-checked'], account: {fingerprint}});
  return {service, adapter, fingerprint};
}

async function checkedTarget(fx) {
  const target = {targetId: 'self', kind: 'user', route: {toUserId: 'ou_self'}};
  await fx.service.createTarget('bot_one', target);
  const {createHash} = await import('node:crypto');
  return createHash('sha256').update(JSON.stringify({kind: target.kind, route: target.route})).digest('hex');
}

test('checked sending rejects changed targets and account identities before a side effect', async () => {
  const fx = checkedFixture(); fx.service.registerAdapter(fx.adapter);
  const digest = await checkedTarget(fx);
  await assert.rejects(fx.service.sendChecked('bot_one', 'self', 'hello', {
    expectedFingerprint: 'b'.repeat(64), expectedTargetDigest: digest,
  }), {code: 'account-changed'});
  await fx.service.updateTarget('bot_one', 'self', {kind: 'user', route: {toUserId: 'ou_other'}});
  await assert.rejects(fx.service.sendChecked('bot_one', 'self', 'hello', {
    expectedFingerprint: fx.fingerprint, expectedTargetDigest: digest,
  }), {code: 'target-changed'});
  assert.equal(fx.adapter.sends.length, 0);
});

test('checked sending freezes the authorized route across an alias edit during account verification', async () => {
  const fx = checkedFixture(); fx.service.registerAdapter(fx.adapter);
  const digest = await checkedTarget(fx);
  const describe = fx.adapter.describeAccount;
  fx.adapter.describeAccount = async () => {
    await fx.adapter.updateTarget('bot_one', 'self', {kind: 'user', route: {toUserId: 'ou_other'}});
    return describe();
  };
  assert.deepEqual(await fx.service.sendChecked('bot_one', 'self', 'hello', {
    expectedFingerprint: fx.fingerprint, expectedTargetDigest: digest,
  }), {sent: true});
  assert.deepEqual(fx.adapter.sends[0][1].route, {toUserId: 'ou_self'});
  assert.equal(fx.adapter.sends[0][3].expectedFingerprint, fx.fingerprint);
});

test('checked sending fails closed when its Registration is disposed during preflight', async () => {
  const fx = checkedFixture(); const dispose = fx.service.registerAdapter(fx.adapter);
  const digest = await checkedTarget(fx);
  const describe = fx.adapter.describeAccount;
  fx.adapter.describeAccount = async () => {dispose(); return describe();};
  await assert.rejects(fx.service.sendChecked('bot_one', 'self', 'hello', {
    expectedFingerprint: fx.fingerprint, expectedTargetDigest: digest,
  }), {code: 'capability-unavailable'});
  assert.equal(fx.adapter.sends.length, 0);
});

test('legacy providers cannot advertise checked sending implicitly', async () => {
  const fx = checkedFixture(); delete fx.adapter.describeAccount; fx.service.registerAdapter(fx.adapter);
  await assert.rejects(fx.service.describeBot('bot_one'), {code: 'capability-unavailable'});
});


test('checked account discovery fences replacement even when the same adapter object is registered again', async () => {
  const service = createDeliveryService();
  const adapter = memoryAdapter();
  let calls = 0;
  adapter.describeAccount = async () => {
    ++calls;
    service.registerAdapter(adapter);
    return {version: 1, botId: 'bot_one', channel: 'weixin', account: {fingerprint: 'a'.repeat(64)}, connected: true, capabilities: ['proactive-text-checked']};
  };
  service.registerAdapter(adapter);
  await assert.rejects(service.describeBot('bot_one'), {code: 'capability-unavailable'});
  assert.equal(calls, 1);
  assert.equal(adapter.sends.length, 0);
});

test('consumer replacement aborts the old account lease and stale dispose cannot remove its successor', async () => {
  const fx = checkedFixture();
  let lease;
  fx.adapter.consumeInbound = async (_id, options) => {
    lease = options;
    return () => {};
  };
  const oldDispose = fx.service.registerAdapter(fx.adapter);
  await fx.service.consumeInbound('bot_one', { expectedFingerprint: fx.fingerprint, onEvent: async () => ({ accepted: true }) });
  fx.service.registerAdapter(fx.adapter);
  assert.equal(lease.signal.aborted, true);
  assert.equal(oldDispose(), false);
  await assert.rejects(lease.onEvent({}, {}), { code: 'capability-unavailable' });
  assert.equal((await fx.service.describeBot('bot_one')).account.fingerprint, fx.fingerprint);
});

test('a reply waiting for provider preflight cannot send after its Registration disappears', async () => {
  const fx = checkedFixture();
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  let resume;
  const ready = new Promise(resolve => { resume = resolve; });
  let sends = 0;
  fx.adapter.replyChecked = async (_id, _route, _text, options) => {
    entered(); await ready;
    options.signal.throwIfAborted();
    sends++;
    return { sent: true };
  };
  const dispose = fx.service.registerAdapter(fx.adapter);
  const result = fx.service.replyChecked('bot_one', { messageId: 'message' }, 'hello', { expectedFingerprint: fx.fingerprint });
  await started;
  dispose(); resume();
  await assert.rejects(result, { code: 'provider-unavailable' });
  assert.equal(sends, 0);
});

test('optional checked history refuses legacy adapters and preserves public read refusals', async () => {
 const fx=checkedFixture();fx.service.registerAdapter(fx.adapter);
 await assert.rejects(fx.service.historyChecked('bot_one',{}, {}, {expectedFingerprint:fx.fingerprint}),{code:'capability-unavailable'});
 for(const code of ['history-permission-denied','stale-route','thread-unavailable','untrusted-source']) {
  fx.adapter.historyChecked=async()=>{throw Object.assign(new Error('refused'),{code});};
  await assert.rejects(fx.service.historyChecked('bot_one',{}, {}, {expectedFingerprint:fx.fingerprint}),{code});
 }
});

test('checked history discards an in-flight result after provider replacement or caller cancellation', async () => {
 for(const cancel of [false,true]) {
  const fx=checkedFixture();fx.service.registerAdapter(fx.adapter);let entered,release;
  const started=new Promise(resolve=>{entered=resolve;});const gate=new Promise(resolve=>{release=resolve;});
  fx.adapter.historyChecked=async()=>{entered();await gate;return {events:['must not escape']};};
  const abort=new AbortController();
  const pending=fx.service.historyChecked('bot_one',{}, {}, {expectedFingerprint:fx.fingerprint,signal:abort.signal});
  await started;
  if(cancel)abort.abort();else fx.service.registerAdapter(fx.adapter);
  release();await assert.rejects(pending,{code:cancel?'cancelled':'capability-unavailable'});
 }
});

function approvalAdapter(channel, keys, { present = async () => true, botId = `bot_${channel.replaceAll('-', '_')}` } = {}) {
  const adapter = memoryAdapter({ channel, botId });
  const offers = [];
  const notices = [];
  Object.assign(adapter, {
    setSessionSync() {},
    listSessionSyncTargets: () => keys.map((_, index) => ({ botId, targetId: `target${index}` })),
    describeSessionSyncApprovalTarget: (_bot, targetId) => ({ conversationKey: keys[Number(targetId.slice(6))] }),
    sendSessionSyncText: async (...args) => notices.push(args),
    presentSessionSyncApproval: async (...args) => { offers.push(args); return present(...args); },
  });
  return { adapter, offers, notices };
}

for (const scenario of ['aliases', 'multiple-chats', 'unresolved', 'unsupported', 'failed']) {
  test(`synced questions: ${scenario} routes to one private chat or sends a desktop notice`, async () => {
    const service = createDeliveryService();
    const keys = scenario === 'multiple-chats' ? ['p2p:a', 'p2p:b'] : ['p2p:a', 'p2p:a'];
    const { adapter, notices } = approvalAdapter('weixin', keys);
    const offered = [];
    adapter.describeSessionSyncQuestionTarget = (_bot, id) => {
      if (scenario === 'unresolved' && id === 'target1') throw new Error('binding unavailable');
      return { conversationKey: keys[Number(id.slice(6))] };
    };
    if (scenario !== 'unsupported') adapter.presentSessionSyncQuestion = async (...args) => {
      offered.push(args);
      return scenario !== 'failed';
    };
    service.registerAdapter(adapter);
    assert.equal(await service.presentSessionSyncQuestion('session', { kind: 'question' }), scenario === 'aliases');
    assert.equal(offered.length, ['aliases', 'failed'].includes(scenario) ? 1 : 0);
    if (scenario === 'aliases') assert.equal(notices.length, 0);
    else {
      assert.equal(notices.length, 2);
      assert.match(notices[0][3], /桌面端回答/);
    }
  });
}

test('weixin: one real bound private chat gets one approval despite target aliases', async () => {
  const service = createDeliveryService();
  const { adapter, offers, notices } = approvalAdapter('weixin', ['p2p:actor', 'p2p:actor']);
  service.registerAdapter(adapter);
  const interaction = { payload: { toolName: 'bash' } };
  assert.equal(await service.presentSessionSyncApproval('session', interaction, {
    completion: new Promise(() => {}),
  }), true);
  assert.equal(offers.length, 1);
  assert.equal(offers[0][3], interaction);
  assert.equal(notices.length, 0);
});
