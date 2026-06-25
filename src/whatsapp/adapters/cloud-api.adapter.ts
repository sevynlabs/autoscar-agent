/**
 * WhatsApp Cloud API Adapter
 * Wraps the Cloud API client to implement the common WhatsAppClient interface
 */

import type { WhatsAppClient, TemplateComponent } from '../whatsapp-client.interface.js';

const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface CloudApiConfig {
  accessToken: string;
  phoneNumberId: string;
}

interface SendMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export class CloudApiAdapter implements WhatsAppClient {
  private config: CloudApiConfig;

  constructor(config: CloudApiConfig) {
    this.config = config;
  }

  private normalizePhone(phone: string): string {
    let digits = phone.replace(/\D/g, '');

    // Add Brazil country code if needed
    if (digits.length === 10 || digits.length === 11) {
      digits = '55' + digits;
    }

    // Remove leading 0 from area code
    if (digits.startsWith('550')) {
      digits = '55' + digits.slice(3);
    }

    return digits;
  }

  async sendText(to: string, text: string): Promise<{ messageId: string }> {
    const phone = this.normalizePhone(to);

    const response = await fetch(
      `${GRAPH_API_BASE}/${this.config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'text',
          text: {
            preview_url: true,
            body: text
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[cloud-api-adapter] Send text failed:', error);
      throw new Error(`WhatsApp Cloud API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json() as SendMessageResponse;
    console.log(JSON.stringify({
      level: 'info',
      msg: '[cloud-api-adapter] Message sent',
      to: phone,
      messageId: result.messages?.[0]?.id,
    }));

    return { messageId: result.messages?.[0]?.id ?? '' };
  }

  async sendMedia(to: string, mediaUrl: string, caption?: string): Promise<{ messageId: string }> {
    const phone = this.normalizePhone(to);

    const response = await fetch(
      `${GRAPH_API_BASE}/${this.config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'image',
          image: {
            link: mediaUrl,
            caption: caption,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[cloud-api-adapter] Send media failed:', error);
      throw new Error(`WhatsApp Cloud API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json() as SendMessageResponse;
    return { messageId: result.messages?.[0]?.id ?? '' };
  }

  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string = 'pt_BR',
    components?: TemplateComponent[]
  ): Promise<{ messageId: string }> {
    const phone = this.normalizePhone(to);

    const body: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };

    if (components && components.length > 0) {
      body.template.components = components;
    }

    const response = await fetch(
      `${GRAPH_API_BASE}/${this.config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[cloud-api-adapter] Send template failed:', error);
      throw new Error(`WhatsApp Cloud API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json() as SendMessageResponse;
    console.log(JSON.stringify({
      level: 'info',
      msg: '[cloud-api-adapter] Template sent',
      to: phone,
      template: templateName,
      messageId: result.messages?.[0]?.id,
    }));

    return { messageId: result.messages?.[0]?.id ?? '' };
  }

  async markAsRead(messageId: string): Promise<void> {
    await fetch(
      `${GRAPH_API_BASE}/${this.config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      }
    ).catch(() => {}); // Non-critical
  }
}
