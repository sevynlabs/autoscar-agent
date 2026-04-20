export interface MessageJobData {
  instance: string;
  phoneNumber: string;
  message: string;
  messageId?: string;
  pushName?: string; // WhatsApp contact display name from the incoming webhook
  channel?: 'whatsapp' | 'instagram' | 'sms'; // defaults to whatsapp
}
