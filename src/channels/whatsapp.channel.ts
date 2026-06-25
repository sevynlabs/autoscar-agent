import { IChannel } from './channel.interface.js';
import { getWhatsAppClient } from '../whatsapp/whatsapp-client.factory.js';
import type { TemplateComponent } from '../whatsapp/whatsapp-client.interface.js';

export class WhatsAppChannel implements IChannel {
  name = 'whatsapp';

  async sendText(to: string, instance: string, text: string): Promise<void> {
    const client = await getWhatsAppClient(instance);
    await client.sendText(to, text);
  }

  async sendMedia(to: string, instance: string, mediaUrl: string, caption?: string): Promise<void> {
    const client = await getWhatsAppClient(instance);
    await client.sendMedia(to, mediaUrl, caption);
  }

  /**
   * Send a WhatsApp template message (Cloud API only)
   * For Evolution API instances, falls back to regular text
   */
  async sendTemplate(
    to: string,
    instance: string,
    templateName: string,
    languageCode?: string,
    components?: TemplateComponent[]
  ): Promise<void> {
    const client = await getWhatsAppClient(instance);
    if (client.sendTemplate) {
      await client.sendTemplate(to, templateName, languageCode, components);
    } else {
      // Fallback for clients without template support
      console.warn('[whatsapp-channel] Template not supported, using sendText fallback');
      await client.sendText(to, 'Oi! Vi que você se interessou por um veículo. Ainda está interessado?');
    }
  }
}
