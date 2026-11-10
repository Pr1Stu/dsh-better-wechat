# Repository boundary

## Current product

This checkout publishes one IM adapter: **Weixin**. It connects WeChat direct messages to a DSH Host. The client contains the Weixin management screen and a separate smart-switching settings screen. Shared Host, Session, workspace, access-policy, delivery and settings code remains only where the current Weixin plugin or its common settings use it.

No other IM adapter is shipped or claimed as supported. References to removed channel implementations in Git history or `docs/方案/` are historical design material, not current capabilities.

## Upstream and this plugin

DSH provides the Host lifecycle, credentials service, Connection RPC, Session storage and query APIs, model calls, workspace APIs, client slots and navigation. `dsh-im` plugs into those services; it does not implement or replace them.

This repository owns the Weixin iLink connection and provisioning flow, its Weixin-specific settings and session state, Jev routing, and the Weixin delivery adapter. It also owns the shared plugin settings and delivery code required by that adapter. A capability is in scope only when the current source, registration path and tests include it; a platform API or an old design document alone is not evidence of support.

## Jev session routing

- Routing is opt-in through `weixin.sessionRouter.classifyEntry`; the settings page switches it on or off, configures the Jev endpoint, and stores the API key separately.
- The configured classifier is a trusted local Node.js entry point. It reads one JSON value from stdin and writes one JSON value to stdout.
- The example classifier calls TypeSafe Jev. Its endpoint and API key are configured in the smart switching page; the key is saved in a local Host file, only its last four characters are returned to the browser, and it is never written to logs.
- An injected DSH model chooses among candidate earlier Sessions. Archived Sessions are excluded.
- Only ordinary text messages enter this path. Commands, image and file flows bypass it. `/new` and a successful manual navigation skip routing for the next message.
- The per-bot index only records Sessions used after routing starts. There is no historical backfill.
- Classification failure keeps the current Session; lookup failure opens a new one rather than binding to an unverified candidate.

## Simulated Weixin access point

- The simulated Weixin service is a separate `dsh-sim-weixin` repository. This checkout keeps only the DSH-side access point in `examples/sim-weixin/`.
- The simulator may receive only the standard iLink bot endpoints. Custom route/switch events and extra `sendmessage` fields are outside the contract.
- Automatic routing may send a user-visible conversation-switch notice through the standard `sendmessage` text path; it never sends a custom route/switch event or field.

## Weixin constraints

- Current inbound support is direct chat only.
- Proactive targets use a Weixin user ID (`toUserId`); group targets and other platform route types are invalid.
- DSH owns Host authentication and access to injected services. The plugin does not promise public-network access or bypass Host policy.
- API keys, account credentials, Session IDs and message text must not be printed in logs or included in screenshots and committed fixtures.

## Change review

When assessing a feature, distinguish DSH-provided service behavior from this plugin's integration. Use the checked-out branch and Git diff to identify newly changed code; do not attribute inherited DSH or prior `dsh-im` behavior to the current change. Keep tests and documentation aligned with the Weixin-only registration boundary.
