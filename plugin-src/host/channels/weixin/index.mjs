import { jevKeyPath, readJevKey, saveJevKey } from './jev-key.mjs';
import { testJevService } from './jev-service.mjs';
import { createRouterSettingsStore } from './router-settings.mjs';
import { createProductionController } from './production.mjs';
import { createWeixinRpcHandler, installWeixinRpc, WEIXIN_RPC_CHANNEL } from './rpc.mjs';
import { installProductionChannel } from '../shared/startup.mjs';
import { publicChannelStartupError } from '../shared/startup-error.mjs';
import { createWeixinDiagnostics } from '../../../../src/channels/weixin/connection-error.mjs';

export const name = 'dsh-weixin-host';
export const inject = ['connection', 'credentials', 'typertGateway', 'sessionQuery', 'llm'];

export async function apply(ctx, config = {}) {
  const logger = typeof ctx.logger === 'function' ? ctx.logger('dsh-weixin') : (ctx.logger ?? console);
  const diagnostics = createWeixinDiagnostics({ logger });
  const keyPath = jevKeyPath(config);
  const routerSettings = createRouterSettingsStore(config, {
    enabled: Boolean(config.sessionRouter?.classifyEntry),
  });
  await routerSettings.load();
  const rpcOptions = {
    ...config.rpcOptions, logger, diagnostics, routerSettings,
    routerConfigured: Boolean(config.sessionRouter?.classifyEntry),
    setJevKey: (key) => saveJevKey(keyPath, key),
    readJevKey: () => readJevKey(keyPath),
    async testJev(signal) {
      let apiKey;
      try {
        apiKey = await readJevKey(keyPath);
      } catch (error) {
        return { state: error?.code === 'EACCES' ? 'key-unreadable' : 'unreachable', latencyMs: 0 };
      }
      return testJevService({ endpoint: routerSettings.get().endpoint, apiKey, signal });
    },
  };
  if (config?.controller) {
    return installWeixinRpc(ctx, config.controller, rpcOptions, config.rpcAuthority);
  }

  return installProductionChannel(ctx, config, {
    channel: 'weixin',
    rpcChannel: WEIXIN_RPC_CHANNEL,
    createProduction: () => createProductionController(ctx, config, { ...config.internals, diagnostics, routerSettings }),
    createHandler: controller => createWeixinRpcHandler(controller, rpcOptions),
    reportStartupError: (error, warning) => diagnostics.report(error, {
      operation: 'startup', stage: warning ? 'connection.stop' : 'startup.load', warning,
      code: publicChannelStartupError('weixin', error).code,
    }).publicError,
  });
}

export function createWeixinHostPlugin(config) {
  return Object.freeze({ name, inject, apply: (ctx) => apply(ctx, config) });
}

export { createConnectionSupervisor, ConnectionSupervisor } from './connection-supervisor.mjs';
export { createProductionController } from './production.mjs';
export {
  WEIXIN_ENDPOINTS,
  WEIXIN_RPC_CHANNEL,
  WEIXIN_RPC_ENDPOINTS,
  createWeixinRpcHandler,
  installWeixinRpc,
} from './rpc.mjs';
export { WeixinController } from '../../../../src/channels/weixin/weixin-controller.mjs';
export { WeixinRuntime } from '../../../../src/channels/weixin/weixin-runtime.mjs';
