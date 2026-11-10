# Weixin session router example

This example is an opt-in extension to the Weixin adapter. It is not needed to connect a bot. It uses TypeSafe Jev to classify a message and a DSH model to find one matching earlier Session.

## Configure

Set the absolute path to `jev-classify.mjs` in the Weixin Host plugin configuration, choose a model for recall, and restart the Host:

```yaml
weixin:
  sessionRouter:
    classifyEntry: /absolute/path/to/examples/weixin-router/jev-classify.mjs
    recallModel:
      provider: local-2048
      model: gemini-flash-latest
```

Set `DSH_IM_JEV_SWITCH_THRESHOLD` in the Host environment. It must be greater than `0` and at most `1`. In **Settings → IM bots → 智能切换设置**, turn on smart routing, enter the Jev model endpoint and save the TypeSafe key. The page can also test the endpoint and shows a status light for the result.

The Host passes the saved endpoint to the classifier as `DSH_IM_JEV_ENDPOINT` and stores the key at `<DSH_HOME>/integrations/dsh-weixin/session-router/jev.key` with owner-only file permissions. Set `sessionRouter.jevKeyFile` to use a different key path, or `sessionRouter.endpoint` for an initial default. The settings page never receives the full key back; it only shows the last four characters.

The example reads one JSON object from stdin and writes one JSON value to stdout. Keep this executable on the Host and treat it as trusted code. The API key is sent only in the Jev HTTPS authorization header; diagnostics omit the key and message content.

`recallEntry` may be configured instead of `recallModel`. It receives the query and verified candidate list as JSON on stdin and must return a candidate Session ID or `null` as JSON on stdout. A returned ID not present in the candidate list is rejected.

## Runtime boundaries

- Routing is attempted only for ordinary Weixin text messages. Commands, images and files bypass it.
- If classification says the message continues the current topic, the current Session is kept. A clear match resumes that Session; no clear match starts a new Session.
- The index records Sessions created or used after routing is enabled. Existing history is not scanned or imported.
- Archived Sessions are excluded. Classification failures keep the current Session; search or recall failures start a new Session.
- `/new`, `/go`, `/prev` and `/next` are manual navigation and skip automatic routing for the next message.

Manual development against a simulated Weixin service lives in the separate `dsh-sim-weixin` repository and the DSH access point in [`examples/sim-weixin`](../sim-weixin/README.md). The simulator is not bundled here.
