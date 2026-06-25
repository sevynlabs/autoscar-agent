/**
 * Common interface for WhatsApp providers (Evolution API and Cloud API)
 */

export interface WhatsAppClient {
  sendText(to: string, text: string): Promise<{ messageId: string }>;
  sendMedia(to: string, mediaUrl: string, caption?: string): Promise<{ messageId: string }>;
  sendTemplate?(to: string, templateName: string, languageCode?: string, components?: TemplateComponent[]): Promise<{ messageId: string }>;
  markAsRead?(messageId: string): Promise<void>;
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: Array<{
    type: 'text' | 'image' | 'document' | 'video';
    text?: string;
    image?: { link: string };
  }>;
}

export type WhatsAppProvider = 'evolution' | 'cloud_api';
