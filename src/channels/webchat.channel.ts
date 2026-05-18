import { IChannel } from './channel.interface.js';

/**
 * Web chat channel (Typebot-style /atendimento page).
 *
 * Unlike WhatsApp/Instagram/SMS there is no outbound provider: the agent reply
 * is returned synchronously in the HTTP response to the browser. These methods
 * are intentional no-ops so the rest of the pipeline (channel.manager, workers)
 * can treat 'webchat' like any other channel without special casing.
 */
export class WebChatChannel implements IChannel {
  name = 'webchat';

  async sendText(): Promise<void> {
    /* no-op — reply is delivered in the HTTP response */
  }

  async sendMedia(): Promise<void> {
    /* no-op */
  }
}
