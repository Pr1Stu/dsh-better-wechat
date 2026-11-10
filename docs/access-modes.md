# Weixin access policy

The Weixin settings page exposes access policy for direct messages only. The group section is disabled because this adapter currently accepts private chats only.

- **Open** lets any Weixin user who can message the bot use it. Command execution can be restricted separately.
- **Allowlist** accepts only the listed Weixin user IDs. An empty list denies everyone.
- In Open mode, per-user command overrides can grant or deny commands without changing who may send ordinary messages.

The policy is stored per bot by the DSH Host. A policy change does not grant or bypass any DSH Host permission, workspace boundary, tool approval or sandbox rule.
