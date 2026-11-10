/**
 * Declared channel capabilities for the session-navigation commands.
 *
 * Declared once here instead of probing the bot adapter per command, so the
 * capability matrix (message buttons, document send) stays auditable in one
 * place. The bridge still verifies the concrete bot method exists before it
 * sends, because a declared capability is not a promise that this bot instance
 * can currently deliver it.
 *
 * - buttons: the preview may carry a native "Hide" button.
 * - fileSend: the /tail export can be delivered as a document attachment.
 */

const NO_CAPABILITIES = Object.freeze({ buttons: false, fileSend: false });

export const CHANNEL_CAPABILITIES = Object.freeze({
  weixin: NO_CAPABILITIES,
});

export function channelCapabilities(channelKey) {
  return CHANNEL_CAPABILITIES[channelKey] ?? NO_CAPABILITIES;
}

/** A document can be delivered only on a file-capable channel with a send method. */
export function documentSendSupported(channelKey, bot) {
  return channelCapabilities(channelKey).fileSend === true
    && typeof bot?.sendFile === 'function';
}

/** A preview may carry a Hide button only on a button-capable channel with cards. */
export function buttonPreviewSupported(channelKey, bot) {
  return channelCapabilities(channelKey).buttons === true
    && typeof bot?.sendInteractionCard === 'function';
}
