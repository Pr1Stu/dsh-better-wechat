# 微信主动投递

本文只描述当前仓库实现的微信适配器。`dsh-im` 不再包含其他 IM 投递适配器。

## 设置投递目标

在「设置 → IM机器人 → 微信 → 投递设置」创建目标。推荐先让机器人收到目标用户的一条私聊消息，再从最近会话中选择。手动目标只支持微信用户 ID。

```json
{
  "botId": "从微信机器人卡片复制的 Bot ID",
  "targetId": "release-alerts",
  "name": "Release alerts",
  "kind": "user",
  "route": { "toUserId": "微信用户 ID" }
}
```

`targetId` 是调用方使用的稳定别名，在同一机器人下唯一。投递目标和微信账号配置保存在当前 DSH Host 的 dsh-im 数据目录。使用设置页的「测试」确认微信端可收到消息，再保存。

## 调用 HTTP 接口

Host 提供 `POST /api/dsh-im/delivery/messages`。请求体必须包含 `botId`、`targetId` 和非空 `text`，可选 `format` 为 `plain` 或 `markdown`：

```sh
curl --request POST \
  http://127.0.0.1:3080/api/dsh-im/delivery/messages \
  --header 'Content-Type: application/json' \
  --data '{
    "botId": "bot_9577c8572d454122a4ef7fb4d8420a91",
    "targetId": "release-alerts",
    "text": "构建已经完成。"
  }'
```

成功返回 `{ "sent": true }`。请求体上限为 1 MiB。默认端口以运行中 Host 输出为准。此插件路由没有单独增加鉴权或 CORS；调用范围仍受 DSH WebServer 与 Host 配置约束，请只在本机或可信网络中使用，不要直接暴露到公网。

## 同 Host 插件调用

同一 Host 的插件可以注入 `dshIm`，调用已保存目标：

```js
export const inject = ['dshIm'];

export async function apply(ctx) {
  await ctx.dshIm.send(
    'bot_9577c8572d454122a4ef7fb4d8420a91',
    'release-alerts',
    '构建已经完成。',
  );
}
```

`send(botId, targetId, text, { signal, format })` 支持取消信号与 `plain` / `markdown` 分段模式。Host 服务也提供目标列表、建议、创建、更新和删除方法；字段校验只接受微信私聊目标。

## 边界

- 目标路由必须是 `{ kind: 'user', route: { toUserId } }`。群聊和其他平台 ID 会被拒绝。
- Bot 必须在线，微信端仍可能拒绝或限制消息。
- 成功表示 Host 的发送调用完成，不代表用户已读。
- `format: 'markdown'` 不会转换为其他平台富文本；微信收到的仍是文本消息。
- HTTP 请求体不接受 Session ID、临时 Webhook 或平台路由字段；只引用事先保存的 `botId + targetId`。
