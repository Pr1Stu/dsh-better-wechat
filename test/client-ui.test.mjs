import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer from 'react-test-renderer';

import { IMSettingsTab } from '../plugin-src/client/index.js';

const { act, create } = TestRenderer;

function textOf(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textOf).join('');
  return textOf(value?.children ?? '');
}

function props(weixinRpcCall) {
  return {
    weixinRpcCall,
    updateRpcCall: async () => ({ ok: true, value: {} }),
    deliveryRpcCall: async () => ({ ok: true, value: {} }),
    globalSettingsRpcCall: async () => ({ ok: true, value: {} }),
    deliverySyncRpcCall: async () => ({ ok: true, value: {} }),
    languageRpcCall: async () => ({ ok: true, value: {} }),
  };
}

async function openJevTab(renderer) {
  await act(async () => {
    renderer.root.findByProps({ id: 'dim-tab-jev' }).props.onClick();
    await Promise.resolve();
  });
}

test('settings exposes Weixin, simulated Weixin and smart switching entries', () => {
  const markup = renderToStaticMarkup(React.createElement(IMSettingsTab, props(async () => ({
    ok: true, value: {},
  }))));
  const tabs = markup.match(/role="tab"/g) ?? [];
  assert.equal(tabs.length, 3);
  assert.match(markup, />微信</);
  assert.match(markup, />模拟微信</);
  assert.match(markup, />智能切换设置</);
  assert.match(markup, /data-im-channel-logo="sim-weixin"/);
  assert.match(markup, /data-im-channel-logo="smart-switch"/);
  assert.doesNotMatch(markup, /飞书|钉钉|企业微信|Telegram|Discord|WhatsApp|Matrix/);
});

test('simulated Weixin is a sibling access point with its own page', async (t) => {
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(IMSettingsTab, props(async () => ({ ok: true, value: {} }))));
  });
  t.after(() => renderer.unmount());
  await act(async () => {
    renderer.root.findByProps({ id: 'dim-tab-sim-weixin' }).props.onClick();
    await Promise.resolve();
  });
  const text = textOf(renderer.toJSON());
  assert.match(text, /模拟微信/u);
  assert.match(text, /独立模拟服务/u);
  assert.match(text, /标准 iLink/u);
  assert.match(text, /127\.0\.0\.1:42049/u);
  assert.match(text, /node src\/cli\.mjs/u);
  const links = renderer.root.findAllByType('a').map((link) => link.props.href);
  assert.ok(links.includes('http://127.0.0.1:42049/'));
  assert.ok(links.includes('https://github.com/Pr1Stu/dsh-better-wechat/blob/main/docs/sim-weixin.md'));
});

test('smart switching page loads status, saves settings and tests the Jev service', async (t) => {
  const calls = [];
  let status = {
    enabled: false,
    endpoint: 'https://api.typesafe.ai/v1/systemone',
    classifyConfigured: true,
    hasApiKey: true,
    apiKeyPreview: '••••1234',
  };
  const rpc = async (endpoint, payload) => {
    calls.push([endpoint, payload]);
    if (endpoint === 'router.status') return { ok: true, value: status };
    if (endpoint === 'router.jev-key.set') {
      status = { ...status, hasApiKey: true, apiKeyPreview: `••••${payload.apiKey.slice(-4)}` };
      return { ok: true, value: { saved: true } };
    }
    if (endpoint === 'router.settings.set') {
      status = { ...status, ...payload };
      return { ok: true, value: { enabled: status.enabled, endpoint: status.endpoint } };
    }
    if (endpoint === 'router.jev.test') {
      return { ok: true, value: { state: 'ok', httpStatus: 200, latencyMs: 8 } };
    }
    return { ok: true, value: {} };
  };
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(IMSettingsTab, props(rpc)));
  });
  t.after(() => renderer.unmount());
  await openJevTab(renderer);
  await act(async () => { await Promise.resolve(); });

  assert.equal(renderer.root.findByProps({ name: 'endpoint' }).props.value,
    'https://api.typesafe.ai/v1/systemone');
  assert.equal(renderer.root.findByProps({ name: 'apiKey' }).props.type, 'password');
  assert.equal(renderer.root.findByProps({ name: 'apiKey' }).props.value, '');
  assert.match(textOf(renderer.toJSON()), /••••1234/u);

  await act(async () => {
    await renderer.root.findByProps({ role: 'switch' }).props.onChange({ target: { checked: true } });
  });
  assert.deepEqual(calls.filter(([endpoint]) => endpoint === 'router.settings.set'), [
    ['router.settings.set', { enabled: true }],
  ]);
  assert.match(textOf(renderer.toJSON()), /智能路由已开启/u);

  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit({
      preventDefault() {},
      currentTarget: { elements: {
        endpoint: { value: 'https://jev.example/v1/classify' },
        apiKey: { value: 'synthetic-key-5678' },
      } },
    });
  });
  assert.deepEqual(calls.filter(([endpoint]) => endpoint === 'router.jev-key.set'), [
    ['router.jev-key.set', { apiKey: 'synthetic-key-5678' }],
  ]);
  assert.deepEqual(calls.filter(([endpoint]) => endpoint === 'router.settings.set').at(-1), [
    'router.settings.set', { endpoint: 'https://jev.example/v1/classify' },
  ]);
  assert.match(textOf(renderer.toJSON()), /智能切换设置已保存/u);
  assert.match(textOf(renderer.toJSON()), /••••5678/u);
  assert.doesNotMatch(textOf(renderer.toJSON()), /synthetic-key-5678/u);

  const testButton = renderer.root.findAllByType('button')
    .find((button) => textOf(button) === '测试连接');
  await act(async () => { await testButton.props.onClick(); });
  assert.deepEqual(calls.filter(([endpoint]) => endpoint === 'router.jev.test'), [
    ['router.jev.test', {}],
  ]);
  assert.match(textOf(renderer.toJSON()), /Jev 服务正常（8 ms）/u);
});

test('smart switching page reports management failures', async (t) => {
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(IMSettingsTab, props(async (endpoint) => {
      if (endpoint === 'router.status') {
        return { ok: true, value: {
          enabled: true,
          endpoint: 'https://jev.example/v1',
          classifyConfigured: false,
          hasApiKey: false,
          apiKeyPreview: '',
        } };
      }
      throw new Error('Host storage is not writable');
    })));
  });
  t.after(() => renderer.unmount());
  await openJevTab(renderer);
  await act(async () => { await Promise.resolve(); });
  assert.match(textOf(renderer.toJSON()), /classifyEntry/u);

  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit({
      preventDefault() {},
      currentTarget: { elements: {
        endpoint: { value: 'https://jev.example/v1' },
        apiKey: { value: 'synthetic-key' },
      } },
    });
  });
  assert.match(textOf(renderer.toJSON()), /Host storage is not writable/u);
});
