export interface MessageJobData {
  instance: string;
  phoneNumber: string;
  message: string;
  messageId?: string;
  channel?: 'whatsapp' | 'instagram' | 'sms'; // defaults to whatsapp
}
