import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import { modernHarnessApi } from '../../plugin-src/host/modern-harness-api.mjs';
import { createWeixinSessionRouter } from '../../plugin-src/host/channels/weixin/session-router.mjs';
import { createRouterSettingsStore } from '../../plugin-src/host/channels/weixin/router-settings.mjs';
import { HarnessClient } from '../../src/channels/weixin/harness-client.mjs';
import { WeixinStateStore } from '../../src/channels/weixin/state-store.mjs';
import { WeixinHarnessBridge } from '../../src/channels/weixin/weixin-bridge.mjs';
import { createWeixinApi } from '../../src/channels/weixin/weixin-api.mjs';

export const name = 'dsh-im-sim-weixin';
export const inject = ['sessionQuery', 'llm', 'connection', 'typertGateway'];

/**
 * DSH access point for the standalone simulated WeChat service. The simulator
 * is a separate process/repository; this plugin only forwards the standard iLink
 * endpoints to it. No routing or session-switch event is sent to the simulator.
 */
export async function apply(ctx, {
  stateDir, workspace,
  simulatorBaseUrl = process.env.DSH_SIM_WEIXIN_URL ?? 'http://127.0.0.1:42049',
  token = process.env.DSH_SIM_WEIXIN_TOKEN ?? 'mock-token',
} = {}) {
  const stop = new AbortController();
  const baseUrl = 'https://ilinkai.weixin.qq.com';
  const simulator = new URL(simulatorBaseUrl);
  if (!simulator.pathname.endsWith('/')) simulator.pathname += '/';
  const api = createWeixinApi({
    fetchImpl: (url, options) => {
      const source = new URL(url);
      return fetch(new URL(`${source.pathname}${source.search}`, simulator), options);
    },
  });
  const state = await new WeixinStateStore(join(stateDir, 'weixin.json')).load();
  const harness = new HarnessClient({ apiProxy: modernHarnessApi(ctx), workspace });
  harness.bindWorkspaceSession = async (key, sessionId) => {
    await harness.adoptWorkspaceSession(sessionId);
    await state.setSession(key, sessionId);
  };
  // Use the same settings file as the Host management page, and reload it before
  // each message so the smart-routing switch and endpoint apply without a restart.
  const routerSettings = createRouterSettingsStore({}, { enabled: true });
  await routerSettings.load();
  const route = createWeixinSessionRouter(ctx, {
    traceContext: true,
    classifyEntry: fileURLToPath(new URL('../weixin-router/jev-classify.mjs', import.meta.url)),
    recallModel: { provider: 'local-2048', model: 'gemini-flash-latest' },
  }, join(stateDir, 'sessions.jsonl'), harness, routerSettings);
  const sessionRouter = route && Object.assign(async (input) => {
    await routerSettings.load();
    return route(input);
  }, { created: route.created });
  const bridge = new WeixinHarnessBridge({
    api, baseUrl, token, ownerUserId: 'owner-user',
    state, harness, sessionRouter, signal: stop.signal,
  });
  ctx.on('dispose', async () => {
    stop.abort();
    await bridge.close();
  });
  console.log(`[weixin-test] Simulated Weixin: ${simulator}`);
  void (async () => {
    while (!stop.signal.aborted) {
      try {
        const updates = await api.getUpdates({ baseUrl, token, signal: stop.signal });
        for (const message of updates.msgs ?? []) {
          void bridge.accept(message).catch(console.error);
        }
      } catch (error) {
        if (!stop.signal.aborted) console.error(error);
      }
      await wait(500, undefined, { signal: stop.signal });
    }
  })().catch((error) => {
    if (!stop.signal.aborted) console.error(error);
  });
}
