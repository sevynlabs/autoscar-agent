import type { FastifyPluginAsync } from 'fastify';
import { getMessageQueue } from '../../queue/queues.js';
import prisma from '../../db/prisma.js';
import type { MessageJobData } from '../../queue/jobs/message.job.js';

function extractPhone(remoteJid: string): string {
  // Handle both @s.whatsapp.net and @lid formats
  return remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '');
}

function extractText(msg: any): string | null {
  if (!msg) return null;
  // Evolution v2 various message formats
  return (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.message?.conversation ??
    msg.message?.extendedTextMessage?.text ??
    null
  );
}

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/webhook/whatsapp', async (request, reply) => {
    const body = request.body as any;
    const event = body.event;
    const instance = body.instance;

    // Log all incoming events for debugging
    console.log(JSON.stringify({
      level: 'debug',
      msg: '[webhook] Event received',
      event,
      instance,
      hasData: !!body.data,
      dataKeys: body.data ? Object.keys(body.data) : [],
    }));

    fastify.log.info({ event, instance }, 'Webhook received');

    // ---- CONNECTION_UPDATE ----
    if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
      const state = body.data?.state;
      if (state) {
        const status = state === 'open' ? 'connected' : state === 'close' ? 'disconnected' : 'connecting';
        await prisma.whatsAppInstance.updateMany({ where: { name: instance }, data: { status } });
        fastify.log.info({ instance, state: status }, 'Connection updated');
      }
      return reply.send({ status: 'connection_updated' });
    }

    // ---- QRCODE ----
    if (event === 'qrcode.updated' || event === 'QRCODE_UPDATED') {
      return reply.send({ status: 'qr_acknowledged' });
    }

    // ---- MESSAGES (upsert, update, set) ----
    if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
      // Evolution v2 sends data as array or object
      const messages = Array.isArray(body.data) ? body.data : [body.data];

      for (const msg of messages) {
        const key = msg.key ?? msg;
        const remoteJid = key.remoteJid ?? '';
        const fromMe = key.fromMe ?? false;
        const messageId = key.id ?? `${Date.now()}`;

        // Skip self, group, status
        if (fromMe) continue;
        if (remoteJid.endsWith('@g.us')) continue;
        if (remoteJid === 'status@broadcast') continue;

        const text = extractText(msg) ?? extractText(msg.message);
        if (!text) continue;

        const phoneNumber = extractPhone(remoteJid);
        const pushName = typeof msg.pushName === 'string' ? msg.pushName.trim() || undefined : undefined;

        fastify.log.info({ phone: phoneNumber, preview: text.substring(0, 50), messageId, pushName }, 'Message received');

        const jobData: MessageJobData = {
          instance,
          phoneNumber,
          message: text,
          messageId,
          pushName,
        };

        const queue = getMessageQueue();
        await queue.add('incoming-message', jobData, {
          jobId: `msg-${instance}-${messageId}`,
          removeOnComplete: 100,
          removeOnFail: 50,
        });
      }

      return reply.send({ status: 'queued' });
    }

    // ---- Ignore other events ----
    return reply.send({ status: 'ignored', event });
  });
};

export default webhookRoutes;
