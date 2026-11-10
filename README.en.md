# DSH Better WeChat

**Connect WeChat to DeepSeek Harness.** This is a Weixin-only DSH plugin with a standalone simulated WeChat access point and Jev-powered smart conversation switching.

- Repository: <https://github.com/Pr1Stu/dsh-better-wechat>
- npm package: `@xmanrui/dsh-im`
- Supported channel: WeChat direct messages (the only shipped IM adapter)
- Simulator: the separate [`sim-weixin`](../../sim-weixin) repository

> Feishu, DingTalk, QQ, WeCom, Slack, Telegram, Discord, WhatsApp, iMessage, Matrix, email and AI Office are not supported by this checkout. Their code and tests have been removed.

## Features

- **QR onboarding**: bind a WeChat bot through Tencent's iLink service; credentials stay on the local DSH Host.
- **WeChat settings**: connection, workspace, model, Agent Preset, access policy, context enhancement and message handling.
- **Smart switching**: enable Jev routing, configure its model endpoint and API key, and test service health; only the key suffix is shown.
- **Jev session routing**: decide whether a message continues the current topic, resumes an earlier Session, or starts a new one.
- **Native switch notices**: when switching or resuming a conversation, send a normal iLink `sendmessage` text notice rather than a custom routing event.
- **Delivery and sync**: proactive targets, Session sync, DS Bot binding, approvals and question sync.
- **Simulated WeChat**: a sibling access point whose simulator lives in its own repository and speaks only the standard iLink protocol.

## Install

Requires Node.js 22.19 or newer. Run the Desktop command in DSH's built-in terminal, or the Web command in the terminal running that Harness.

```sh
dsh plugin --profile desktop add -w @xmanrui/dsh-im
dsh plugin --profile web add -w @xmanrui/dsh-im
```

Restart Desktop or `dsh web`; in Web, refresh the page and open **Settings → IM bots**.

## Quick start

1. Open **Settings → IM bots → WeChat** and choose **Scan to connect bot**.
2. Scan with WeChat and confirm; wait until the connection is online.
3. Configure the workspace, model, Agent Preset and access policy on the bot card.
4. For automatic conversation switching, open **智能切换设置** and configure Jev as described below.

## Smart switching / Jev routing

Routing is off by default. The Host plugin configuration needs the absolute path to a classifier and a model used to recall earlier Sessions:

```yaml
weixin:
  sessionRouter:
    classifyEntry: /absolute/path/to/examples/weixin-router/jev-classify.mjs
    recallModel:
      provider: local-2048
      model: gemini-flash-latest
```

Set the switch threshold (greater than 0 and at most 1):

```sh
export DSH_IM_JEV_SWITCH_THRESHOLD=0.85
```

Then in **Settings → IM bots → 智能切换设置**:

- enable **Smart routing**;
- fill in the Jev model endpoint;
- save the TypeSafe Jev API key;
- press **Test connection** until the status light is green.

Settings are stored in `<DSH_HOME>/integrations/dsh-weixin/session-router/settings.json`; the key is stored in `jev.key` in the same directory. The page shows only the last four characters. The full key is never returned to the browser or written to logs.

Routing applies only to ordinary text messages. Commands, images and files keep their own flows. The index records only Sessions created or used after routing is enabled; history is not backfilled. Classification failures keep the current Session; recall failures open a new Session instead of binding to an unverified candidate.

See [the Weixin router example](examples/weixin-router/README.md) for the complete setup.

## Simulated WeChat access point

The simulator is the separate `dsh-sim-weixin` repository next to this checkout. It does not start with this plugin.

It runs as its own DSH plugin:

```yaml
- insert:
    - id: dsh-sim-weixin
      name: /absolute/path/to/sim-weixin/src/plugin.mjs
      config:
        port: 42049
        token: mock-token
```

The DSH-side access point example is [`examples/sim-weixin/manual-host.mjs`](examples/sim-weixin/README.md). The **Simulated WeChat** settings page shows the simulator address and start command.

Protocol rules:

- Only the standard iLink endpoints are allowed: `getupdates`, `getconfig`, `sendtyping`, `sendmessage`, `msg/notifystart`, `msg/notifystop`.
- Custom endpoints such as `/route` or `/switch`, and routing fields in `sendmessage`, are rejected.
- Conversation-switch notices may only be sent as ordinary text messages.
- See the simulator's [`PROTOCOL.md`](../../sim-weixin/PROTOCOL.md) and the [access-point guide](docs/sim-weixin.md).

## Commands

Send `/help` in WeChat for the full list. Common commands:

| Command | Purpose |
| --- | --- |
| `/new` | Start a new session |
| `/go`, `/prev`, `/next` | Switch between recent sessions |
| `/workspace`, `/wsl` | Switch/list workspaces |
| `/sessionlist`, `/session` | List or bind Sessions |
| `/model`, `/reasoning` | View or change model and reasoning effort |
| `/status` | Show workspace, session, model and running state |

See the [Weixin command guide](docs/bot-commands.md).

## Project layout

```text
plugin-src/host/                Host plugin, management RPC, delivery and routing wiring
plugin-src/client/              React settings UI (WeChat, simulated WeChat, smart switching, general)
src/channels/weixin/            iLink client, bridge, state, session routing and executors
lib/                            Build outputs generated by npm run build
test/                           Shared and WeChat-specific tests
examples/weixin-router/         Example Jev classifier
examples/sim-weixin/            DSH-side access point for the simulator
docs/                           Current documentation and historical design notes
```

DSH provides the Host lifecycle, credentials, Connection RPC, Session storage/query, model calls and workspace APIs. This repository owns the WeChat adapter and its extensions.

## Development

Run these commands from `upstream/dsh-im/`:

```sh
npm ci
npm run build
npm test
npm run check
```

- `npm run build` refreshes the Host and Client bundles in `lib/`.
- `npm test` runs the shared and WeChat channel tests.
- `npm run check` builds, tests and verifies the published package.

Local simulator profile (workspace root):

```sh
.dsh-test/start-manual.sh
.dsh-test/status-manual.sh
.dsh-test/stop-manual.sh
```

## Security

- API keys, account credentials, Session IDs and message bodies are never written to logs.
- The settings page shows only the last four characters of the Jev key; the full key is not returned to the browser.
- The simulator listens on loopback only and must not be used as a production WeChat endpoint.

## Documentation

- [Documentation index](docs/README.md)
- [Weixin commands](docs/bot-commands.md)
- [Access modes](docs/access-modes.md)
- [Context enhancement](docs/context-enhancement.md)
- [Proactive delivery API](PROACTIVE_DELIVERY.en.md)
- [Client panel integration](docs/client-integration.md)
- [Preset workspace groups](docs/preset-workspaces.md)
- [Simulated WeChat access point](docs/sim-weixin.md)

## License

MIT. See [LICENSE](LICENSE).
