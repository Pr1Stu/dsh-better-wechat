# 客户端面板接入 / Client panel integration

`dshImClient` 是可选的同客户端面板服务。默认「设置 → IM机器人」入口仍保留；当前面板只有微信、模拟微信、智能切换设置和通用设置。

`dshImClient` is an optional panel service for another plugin in the same DSH client. The default **Settings → IM bots** entry remains available. The current panel contains Weixin, simulated Weixin, smart switching and General settings only.

```ts
interface DshImClient {
  readonly version: 1;
  render(props?: { preferredSectionId?: 'weixin' | 'sim-weixin' | 'jev' | 'global-settings' }): React.ReactElement | null;
  setSettingsVisible(visible: boolean): void;
  settingsVisible(): boolean;
}
```

`render()` returns the existing React panel and does not mount it. Use the DSH client's React instance. `preferredSectionId` chooses the initial view; invalid or omitted values open Weixin. The smart switching page reads and writes Jev routing settings through the Weixin Host management RPC.

```js
export const inject = ['dshImClient'];

export function apply(ctx) {
  const im = ctx.dshImClient;
  if (im.version !== 1) return;
  mountPanel(() => im.render({ preferredSectionId: 'weixin' }));
  im.setSettingsVisible(false);
}
```

`mountPanel` is provided by the consuming plugin. Restore the Settings entry when the embedded panel is removed. Visibility is local to the current client and is not persisted. Embedding the panel does not add IM adapters or bypass Host RPC permissions.
