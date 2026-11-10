# Simulated Weixin access point

This example is the DSH-side access point for the standalone
[`dsh-sim-weixin`](../../../../sim-weixin) repository. It does not start or embed
the simulator: run that repository separately, then point this plugin at its
address.

```yaml
- insert:
    - id: dsh-sim-weixin
      name: /absolute/path/to/sim-weixin/src/plugin.mjs
      config:
        port: 42049
        token: mock-token
- insert:
    - id: dsh-im-sim-weixin
      name: /absolute/path/to/dsh-im/examples/sim-weixin/manual-host.mjs
      config:
        simulatorBaseUrl: http://127.0.0.1:42049
        token: mock-token
        stateDir: /absolute/path/to/state
        workspace: /absolute/path/to/workspace
- insert:
    - id: xmanrui-dsh-im
      name: '@xmanrui/dsh-im'
      config:
        weixin:
          sessionRouter:
            classifyEntry: /absolute/path/to/dsh-im/examples/weixin-router/jev-classify.mjs
            recallModel:
              provider: local-2048
              model: gemini-flash-latest
```

The `xmanrui-dsh-im` entry configures the settings page. Its
`classifyEntry` makes the page report smart routing as configured; the manual
access point uses the same `session-router/settings.json`, reloading it before
each message, so the switch and endpoint apply without restarting.

The plugin keeps `https://ilinkai.weixin.qq.com/` as the trusted logical base
URL and forwards only that origin's standard iLink paths to the simulator. It
never posts a route/switch event or a custom delivery event; the simulator sees
only `getupdates`, `getconfig`, `sendtyping`, `sendmessage`, `notifystart` and
`notifystop`.

The communication contract is documented in
[`sim-weixin/PROTOCOL.md`](../../../../sim-weixin/PROTOCOL.md).

`simulatorBaseUrl` and `token` can also come from `DSH_SIM_WEIXIN_URL` and
`DSH_SIM_WEIXIN_TOKEN`.
