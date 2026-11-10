# Weixin proactive delivery

This document covers the Weixin adapter in the current checkout. `dsh-im` no longer includes other IM delivery adapters.

## Create a target

In **Settings → IM bots → WeChat → Delivery**, create a target. For suggestions, first have the bot receive a direct message from the intended user, then select that conversation. A manual target accepts a Weixin user ID only.

```json
{
  "botId": "Copy the Bot ID from the Weixin bot card",
  "targetId": "release-alerts",
  "name": "Release alerts",
  "kind": "user",
  "route": { "toUserId": "Weixin user ID" }
}
```

`targetId` is a stable caller-defined alias, unique within one bot. Delivery targets and Weixin account configuration are stored in the current DSH Host's dsh-im data directory. Use **Test** and confirm the message arrives in WeChat before saving.

## Call the HTTP endpoint

The Host provides `POST /api/dsh-im/delivery/messages`. The JSON body requires `botId`, `targetId` and non-empty `text`; optional `format` may be `plain` or `markdown`:

```sh
curl --request POST \
  http://127.0.0.1:3080/api/dsh-im/delivery/messages \
  --header 'Content-Type: application/json' \
  --data '{
    "botId": "bot_9577c8572d454122a4ef7fb4d8420a91",
    "targetId": "release-alerts",
    "text": "The build has completed."
  }'
```

Success returns `{ "sent": true }`. The request body limit is 1 MiB. Use the port printed by the running Host if it differs from the default. This plugin route does not add its own authentication or CORS; access is still subject to the DSH WebServer and Host configuration. Use it only locally or on a trusted network, and do not expose it directly to the public internet.

## Call from another plugin in the same Host

Another plugin in the same Host can inject `dshIm` and send through a saved target:

```js
export const inject = ['dshIm'];

export async function apply(ctx) {
  await ctx.dshIm.send(
    'bot_9577c8572d454122a4ef7fb4d8420a91',
    'release-alerts',
    'The build has completed.',
  );
}
```

`send(botId, targetId, text, { signal, format })` accepts an abort signal and `plain` / `markdown` chunking. The Host service also exposes target listing, suggestions, creation, update and deletion; validation accepts Weixin direct-message targets only.

## Limits

- A route must be `{ kind: 'user', route: { toUserId } }`. Group routes and other platform IDs are rejected.
- The bot must be online, and WeChat may still reject or limit a message.
- Success means the Host send call completed; it does not mean the user read the message.
- `format: 'markdown'` does not render platform rich text; WeChat still receives a text message.
- The HTTP body does not accept a Session ID, temporary webhook or platform route. It references a saved `botId + targetId` pair only.
