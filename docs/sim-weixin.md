# Simulated Weixin access point

The simulated Weixin service is not part of this package. It lives in the
separate `dsh-sim-weixin` repository, next to this checkout:

```
dsh-im-router-codex/
  sim-weixin/     standalone simulator + PROTOCOL.md
  upstream/dsh-im/
```

This package keeps only the DSH-side access point:
[`examples/sim-weixin/manual-host.mjs`](../examples/sim-weixin/manual-host.mjs).
It forwards the standard iLink paths to the simulator while keeping
`https://ilinkai.weixin.qq.com/` as the trusted logical base URL.

## Contract

The simulator accepts only these standard iLink bot endpoints:

- `POST /ilink/bot/getupdates`
- `POST /ilink/bot/getconfig`
- `POST /ilink/bot/sendtyping`
- `POST /ilink/bot/sendmessage`
- `POST /ilink/bot/msg/notifystart`
- `POST /ilink/bot/msg/notifystop`

Every request uses `Authorization: Bearer <token>` and a JSON body. The full
request/response schema is documented in the simulator repository's
`PROTOCOL.md` in the simulator repository (sibling checkout path:
`sim-weixin/PROTOCOL.md`).

## Conversation-switch notices use standard messages

- The plugin never posts a custom `route`, `switch`, `session` or similar event
  to the simulator.
- `sendmessage` carries only standard text items. Extra fields such as
  `msg.route` are rejected by the simulator.
- Routing decisions stay inside the DSH side. When a switch or resume happens,
  the plugin may send a short user-visible notice such as “已切换到新话题” or
  “已接回旧话题”. That notice is an ordinary text `sendmessage`, not a custom
  event or field.
- The simulator's local `/input` and `/events` endpoints belong to its own page;
  the plugin must not call them.

## Running locally

Start the simulator separately (its repository documents the CLI and plugin
forms), then load `examples/sim-weixin/manual-host.mjs` with:

```yaml
config:
  simulatorBaseUrl: http://127.0.0.1:42049
  token: mock-token
  stateDir: /absolute/path/to/state
  workspace: /absolute/path/to/workspace
```

Also configure the settings-page host plugin so it reports routing as
configured:

```yaml
- id: xmanrui-dsh-im
  config:
    weixin:
      sessionRouter:
        classifyEntry: /absolute/path/to/dsh-im/examples/weixin-router/jev-classify.mjs
        recallModel:
          provider: local-2048
          model: gemini-flash-latest
```

The manual access point reloads the shared `session-router/settings.json` before
each message, so the smart-routing switch and Jev endpoint apply without a
restart. `DSH_SIM_WEIXIN_URL` and `DSH_SIM_WEIXIN_TOKEN` provide the same values
without editing the patch file.
