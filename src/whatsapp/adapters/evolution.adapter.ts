/**
 * Evolution API Adapter
 * Wraps the Evolution client to implement the common WhatsAppClient interface
 */

import type { WhatsAppClient } from '../whatsapp-client.interface.js';
import { evolutionClient } from '../evolution.client.js';

export class EvolutionAdapter implements WhatsAppClient {
  constructor(private instanceName: string) {}

  async sendText(to: string, text: string): Promise<{ messageId: string }> {
    const result = await evolutionClient.sendText(this.instanceName, to, text);
    return { messageId: result.key?.id ?? '' };
  }

  async sendMedia(to: string, mediaUrl: string, caption?: string): Promise<{ messageId: string }> {
    await evolutionClient.sendMedia(this.instanceName, to, mediaUrl, caption);
    return { messageId: '' }; // Evolution sendMedia doesn't return message ID
  }

  // Evolution API doesn't support templates - use regular text
  async sendTemplate(to: string, templateName: string): Promise<{ messageId: string }> {
    console.warn('[evolution-adapter] Templates not supported, sending as regular text');
    const fallbackText = 'Oi! Vi que você se interessou por um veículo. Ainda está interessado?';
    return this.sendText(to, fallbackText);
  }
}
