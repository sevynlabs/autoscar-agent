import { IChannel } from './channel.interface.js';
import { getEvolutionClient } from '../whatsapp/evolution.client.js';

export class WhatsAppChannel implements IChannel {
  name = 'whatsapp';

  async sendText(to: string, instance: string, text: string): Promise<void> {
    const client = getEvolutionClient();
    await client.sendText(instance, to, text);
  }

  async sendMedia(to: string, instance: string, mediaUrl: string, caption?: string): Promise<void> {
    const client = getEvolutionClient();
    await client.sendMedia(instance, to, mediaUrl, caption);
  }
}
