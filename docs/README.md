# Documentation

These documents describe the current Weixin-only package unless marked historical.

## Current

- [Weixin commands](bot-commands.md)
- [Access modes](access-modes.md)
- [Context enhancement](context-enhancement.md)
- [Deferred delivery](deferred-delivery.md)
- [Proactive delivery API](../PROACTIVE_DELIVERY.md)
- [Client panel integration](client-integration.md)
- [Simulated Weixin access point](sim-weixin.md)
- [Preset workspace groups](preset-workspaces.md)
- [Checking and installing updates](checking-and-installing-updates.md)

The matching Chinese documents are maintained alongside their English versions where available.

## Historical and internal notes

`方案/`, `adr/` and dated implementation notes record earlier investigations, architecture decisions or proposals. They may describe adapters and capabilities that this checkout no longer contains; they do not define current support. The live boundary is the adapter registration under `plugin-src/host/index.mjs`, the settings UI under `plugin-src/client/index.js`, and the package manifest.

`agent-mail-protocol.md` and `agent-mail-reply-loop-defect.md` are retained as historical notes about a removed email integration.
