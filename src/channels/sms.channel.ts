import { IChannel } from './channel.interface.js';

export class SmsChannel implements IChannel {
  name = 'sms';

  private get accountSid() { return process.env.TWILIO_ACCOUNT_SID || ''; }
  private get authToken() { return process.env.TWILIO_AUTH_TOKEN || ''; }
  private get fromNumber() { return process.env.TWILIO_FROM_NUMBER || ''; }

  private get isConfigured() {
    return !!(this.accountSid && this.authToken && this.fromNumber);
  }

  async sendText(to: string, _instance: string, text: string): Promise<void> {
    if (!this.isConfigured) {
      console.warn('[SMS] Twilio not configured, skipping send');
      return;
    }

    const normalizedTo = to.startsWith('+') ? to : `+55${to.replace(/\D/g, '')}`;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: normalizedTo,
        From: this.fromNumber,
        Body: text,
      }),
    });
  }

  async sendMedia(to: string, instance: string, mediaUrl: string, caption?: string): Promise<void> {
    // SMS doesn't support media, send caption text only
    if (caption) await this.sendText(to, instance, caption);
  }
}
