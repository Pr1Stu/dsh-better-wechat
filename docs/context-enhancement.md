# Context enhancement

On a Weixin bot card, open **Context enhancement** to add selected message metadata and guidance to model input. Settings are saved per bot. The current adapter supports direct messages only; group settings are retained for compatibility but are not used by Weixin.

Available metadata fields are `channel`, `conversationType`, `senderId`, `senderName`, `conversationTitle`, `chatId`, `threadId` and `botId`. Only selected values already present on the inbound message are included. The plugin does not query WeChat for profile details to fill missing values.

This changes model context only. It does not change the message sender, access policy, Session binding or DSH tool permissions.
