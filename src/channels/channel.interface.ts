export interface IChannel {
  name: string;
  sendText(to: string, instance: string, text: string): Promise<void>;
  sendMedia(to: string, instance: string, mediaUrl: string, caption?: string): Promise<void>;
}

export interface IncomingMessage {
  channel: 'whatsapp' | 'instagram' | 'sms';
  from: string;
  instance: string;
  content: string;
  mediaUrl?: string;
}
