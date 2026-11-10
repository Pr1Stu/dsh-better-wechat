# Weixin commands

This list is for the Weixin direct-message adapter. Send `/help` to the bot for the localized command list. Commands are plain text and use the permissions configured for that bot.

## Sessions

- `/new` starts a new Session.
- `/sessionlist` or `/sessions` lists Sessions. `/session <ID, number or title>` binds this chat to one.
- `/ls` or `/list` shows Sessions used in this chat. `/go <number>`, `/prev` and `/next` navigate that list.
- `/drop <number>` removes a row from this chat's list; it does not delete the Harness Session.
- `/title [new title]` reads or changes the current title. `/title <number> <new title>` renames a listed Session.
- `/fork [title]` starts a branch from the current Session. `/reset` resets its context while keeping its ID.
- `/tail` or `/peek [number] [count]` previews recent user and assistant messages; it does not run the model.
- `/history [count]` reads recent messages from the current Session (up to five).

Session lists and bindings belong to this Weixin private chat. Changing the bound Session affects where future replies go.

## Work and model settings

- `/workspace [number or absolute path]` switches the bot workspace; `/workspacelist` lists workspaces. `/ws`, `/wsl` and `/workspaces` are aliases.
- `/models`, `/model`, `/reasoninglist` and `/reasoning` inspect or change the Session model and reasoning level.
- `/presetlist` and `/preset` inspect or change the bot's Agent Preset.
- `/plan [off or instructions]` changes plan mode. `/goal [text]` reads or sets the current goal; `clear`, `edit`, `pause` and `resume` are supported actions.
- `/compact` compacts earlier context. `/clear` clears the current context while keeping the Session binding and history.

## Control and status

- `/stop` stops the current task; `/steer <text>` sends a correction to it.
- `/batch` starts a batch of up to ten text messages. `/send` submits it; `/cancel` discards it.
- `/status` checks the Weixin and Harness connection. `/version` reports the plugin version. `/help` displays commands.

Automatic Jev routing, when configured, skips commands. Manual `/new`, `/go`, `/prev` and `/next` also skip automatic routing for the next ordinary message.
