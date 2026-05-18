import { IChannel } from './channel.interface.js';
import { WhatsAppChannel } from './whatsapp.channel.js';
import { InstagramChannel } from './instagram.channel.js';
import { SmsChannel } from './sms.channel.js';
import { WebChatChannel } from './webchat.channel.js';

const channels: Record<string, IChannel> = {};

function init() {
  if (Object.keys(channels).length > 0) return;
  const wa = new WhatsAppChannel();
  const ig = new InstagramChannel();
  const sms = new SmsChannel();
  const web = new WebChatChannel();
  channels[wa.name] = wa;
  channels[ig.name] = ig;
  channels[sms.name] = sms;
  channels[web.name] = web;
}

export function getChannel(name: string): IChannel {
  init();
  const ch = channels[name];
  if (!ch) throw new Error(`Unknown channel: ${name}`);
  return ch;
}

export function getAllChannels(): IChannel[] {
  init();
  return Object.values(channels);
}
