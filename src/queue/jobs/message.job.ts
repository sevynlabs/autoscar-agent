import type { AdReferral } from '../../whatsapp/inbound.js';

export interface MessageJobData {
  instance: string;
  phoneNumber: string;
  message: string;
  messageId?: string;
  pushName?: string; // WhatsApp contact display name from the incoming webhook
  referral?: AdReferral | null; // click-to-WhatsApp ad that opened the chat
  channel?: 'whatsapp' | 'instagram' | 'sms' | 'webchat'; // defaults to whatsapp
}
