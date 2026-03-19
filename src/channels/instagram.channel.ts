import { IChannel } from './channel.interface.js';

const INSTAGRAM_API = 'https://graph.instagram.com/v21.0';

export class InstagramChannel implements IChannel {
  name = 'instagram';

  private get accessToken() {
    return process.env.INSTAGRAM_ACCESS_TOKEN || '';
  }

  async sendText(to: string, _instance: string, text: string): Promise<void> {
    const pageId = process.env.INSTAGRAM_PAGE_ID;
    if (!pageId || !this.accessToken) {
      console.warn('[Instagram] Not configured, skipping send');
      return;
    }

    await fetch(`${INSTAGRAM_API}/${pageId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: to },
        message: { text },
      }),
    });
  }

  async sendMedia(to: string, _instance: string, mediaUrl: string, caption?: string): Promise<void> {
    const pageId = process.env.INSTAGRAM_PAGE_ID;
    if (!pageId || !this.accessToken) return;

    await fetch(`${INSTAGRAM_API}/${pageId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: to },
        message: {
          attachment: {
            type: 'image',
            payload: { url: mediaUrl, is_reusable: true },
          },
          text: caption,
        },
      }),
    });
  }
}
