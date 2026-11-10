# DSH Better WeChat

**把微信接入 DeepSeek Harness。** 本仓库是 Weixin-only 的 DSH 插件，同时提供独立的模拟微信接入点和 Jev 智能会话切换。

- 仓库：<https://github.com/Pr1Stu/dsh-better-wechat>
- npm 包：`@xmanrui/dsh-im`
- 支持渠道：微信私聊（唯一正式 IM 渠道）
- 模拟接入点：独立的 [`sim-weixin`](../../sim-weixin) 仓库

> 飞书、钉钉、QQ、企业微信、Slack、Telegram、Discord、WhatsApp、iMessage、Matrix、邮箱和 AI Office 均不属于当前版本的支持范围；相关代码和测试已从本仓库移除。

## 功能

- **扫码接入微信**：通过腾讯微信 iLink 服务扫码绑定机器人，账号凭据只写入本机 DSH Host。
- **微信设置**：连接、工作区、模型、Agent Preset、访问策略、上下文增强和消息处理方式。
- **智能切换设置**：开关智能路由，配置 Jev 模型端点与 API Key，并测试 Jev 服务状态；密钥只显示尾号。
- **Jev 会话路由**：判断新消息是延续当前话题、接回已有 Session，还是开启新 Session。
- **原生切换提示**：切换或接回会话时，通过标准 iLink `sendmessage` 发送一条普通文本提示，不发送自定义路由事件。
- **投递与同步**：主动投递目标、Session 同步、DS Bot 绑定和审批/提问同步等共享能力。
- **模拟微信接入点**：与微信并列的独立接入点，模拟器运行在单独仓库，只使用标准 iLink 端点。

## 安装

需要 Node.js 22.19 或更新版本。Desktop 命令在 DSH 内置终端执行；Web 命令在运行该 Harness 的终端执行。

```sh
dsh plugin --profile desktop add -w @xmanrui/dsh-im
dsh plugin --profile web add -w @xmanrui/dsh-im
```

安装后重启 Desktop 或 `dsh web`；Web 端刷新页面，再打开「设置 → IM机器人」。

## 快速开始

1. 打开「设置 → IM机器人 → 微信」，点击「扫码接入机器人」。
2. 用手机微信扫码并确认，等待连接状态变为在线。
3. 在机器人卡片中配置工作区、模型、Agent Preset 和访问策略。
4. 如需自动切换会话，打开「智能切换设置」并按下一节配置 Jev 路由。

## 智能切换 / Jev 会话路由

路由默认关闭。Host 插件配置中需要提供分类程序的绝对路径，并选择用于寻回旧 Session 的模型：

```yaml
weixin:
  sessionRouter:
    classifyEntry: /absolute/path/to/examples/weixin-router/jev-classify.mjs
    recallModel:
      provider: local-2048
      model: gemini-flash-latest
```

同时配置切换阈值（大于 0 且不超过 1）：

```sh
export DSH_IM_JEV_SWITCH_THRESHOLD=0.85
```

然后在「设置 → IM机器人 → 智能切换设置」中：

- 打开「智能路由」；
- 填写 Jev 模型端点；
- 保存 TypeSafe Jev API Key；
- 点击「测试连接」确认状态灯为绿色。

设置保存在 `<DSH_HOME>/integrations/dsh-weixin/session-router/settings.json`，密钥保存在同目录的 `jev.key`。页面只显示密钥末四位，完整密钥不会回传浏览器，也不会写入日志。

路由只处理普通文字消息；命令、图片、文件沿用各自流程。索引只记录启用路由后新建或使用的 Session，不回填历史。分类失败保留当前 Session；查找失败时新开会话，避免绑定到未验证的候选。

完整配置与示例见 [微信路由示例](examples/weixin-router/README.md)。

## 模拟微信接入点

模拟微信是独立仓库 `dsh-sim-weixin`（与本仓库同级），不随本插件启动。

它以单独的 DSH 插件运行：

```yaml
- insert:
    - id: dsh-sim-weixin
      name: /absolute/path/to/sim-weixin/src/plugin.mjs
      config:
        port: 42049
        token: mock-token
```

DSH 侧的接入示例是 [`examples/sim-weixin/manual-host.mjs`](examples/sim-weixin/README.md)；设置页中的「模拟微信」页面会显示模拟器地址和启动命令。

通信约定：

- 只允许标准 iLink 端点：`getupdates`、`getconfig`、`sendtyping`、`sendmessage`、`msg/notifystart`、`msg/notifystop`。
- 禁止 `/route`、`/switch` 等自定义端点，也禁止在 `sendmessage` 中加入路由字段。
- 切换会话提示只能作为普通文本消息发送。
- 完整规范见模拟器仓库的 [`PROTOCOL.md`](../../sim-weixin/PROTOCOL.md) 和[接入说明](docs/sim-weixin.md)。

## 常用命令

在微信中发送 `/help` 查看完整命令。常用命令：

| 命令 | 作用 |
| --- | --- |
| `/new` | 开启新会话 |
| `/go`、`/prev`、`/next` | 在最近会话间切换 |
| `/workspace`、`/wsl` | 切换/列出工作区 |
| `/sessionlist`、`/session` | 查看或绑定 Session |
| `/model`、`/reasoning` | 查看或切换模型与推理等级 |
| `/status` | 查看当前工作区、会话、模型和运行状态 |

详见[微信命令说明](docs/bot-commands.md)。

## 项目结构

```text
plugin-src/host/                 DSH Host 插件、管理 RPC、投递和路由接线
plugin-src/client/               React 设置界面（微信、模拟微信、智能切换、通用设置）
src/channels/weixin/             iLink 客户端、桥接、状态、会话路由与执行器
lib/                             构建产物（由 npm run build 生成）
test/                            共享与微信渠道测试
examples/weixin-router/          Jev 分类程序示例
examples/sim-weixin/             模拟微信的 DSH 侧接入示例
docs/                            当前文档与历史方案
```

DSH 提供 Host 生命周期、凭据、Connection RPC、Session 存储/查询、模型调用和工作区 API；本仓库只实现微信适配器及其扩展。

## 开发

从 `upstream/dsh-im/` 目录执行：

```sh
npm ci
npm run build
npm test
npm run check
```

- `npm run build` 更新 `lib/` 中的 Host 和 Client 产物。
- `npm test` 运行共享和微信渠道测试。
- `npm run check` 构建、测试并校验发布包。

本地模拟联调（工作区根目录）：

```sh
.dsh-test/start-manual.sh
.dsh-test/status-manual.sh
.dsh-test/stop-manual.sh
```

## 安全

- API Key、账号凭据、Session ID 和消息正文不会写入日志。
- 设置页面只展示 Jev 密钥末四位；完整密钥不会回传浏览器。
- 模拟微信只监听本机回环地址，不能作为生产微信地址使用。

## 文档

- [文档索引](docs/README.md)
- [微信命令](docs/bot-commands.md)
- [访问模式](docs/access-modes.md)
- [上下文增强](docs/context-enhancement.md)
- [主动投递 API](PROACTIVE_DELIVERY.md)
- [客户端面板集成](docs/client-integration.md)
- [预设工作区](docs/preset-workspaces.md)
- [模拟微信接入点](docs/sim-weixin.md)

## 许可证

MIT。见 [LICENSE](LICENSE)。
