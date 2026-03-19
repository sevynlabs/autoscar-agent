import type { FastifyPluginAsync } from 'fastify';
import { getMessageQueue } from '../../queue/queues.js';
import prisma from '../../db/prisma.js';
import { emitNewMessage } from '../../realtime/emitter.js';
import type { MessageJobData } from '../../queue/jobs/message.job.js';

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key?: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text?: string;
      };
    };
    // CONNECTION_UPDATE fields
    state?: string;
    statusReason?: number;
  };
}

function extractTextContent(data: EvolutionWebhookPayload['data']): string | null {
  return (
    data.message?.conversation ??
    data.message?.extendedTextMessage?.text ??
    null
  );
}

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/webhook/whatsapp', async (request, reply) => {
    const body = request.body as EvolutionWebhookPayload;
    const { event, instance, data } = body;

    // ---- CONNECTION_UPDATE: sync instance status in DB ----
    if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
      const state = data.state; // 'open' | 'close' | 'connecting'
      if (state) {
        const status = state === 'open' ? 'connected' : state === 'close' ? 'disconnected' : 'connecting';
        await prisma.whatsAppInstance.updateMany({
          where: { name: instance },
          data: { status },
        });
        fastify.log.info({ instance, state: status }, 'WhatsApp connection updated');
      }
      return reply.send({ status: 'connection_updated' });
    }

    // ---- QRCODE_UPDATED: just acknowledge ----
    if (event === 'qrcode.updated' || event === 'QRCODE_UPDATED') {
      return reply.send({ status: 'qr_acknowledged' });
    }

    // ---- MESSAGES_UPSERT: process incoming message ----
    if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') {
      return reply.send({ status: 'ignored', reason: 'unhandled event' });
    }

    if (!data.key) {
      return reply.send({ status: 'ignored', reason: 'no key' });
    }

    // Skip self-messages and group messages
    if (data.key.fromMe) {
      return reply.send({ status: 'ignored', reason: 'self message' });
    }

    if (data.key.remoteJid.endsWith('@g.us')) {
      return reply.send({ status: 'ignored', reason: 'group message' });
    }

    const text = extractTextContent(data);
    if (!text) {
      return reply.send({ status: 'ignored', reason: 'no text content' });
    }

    const phoneNumber = data.key.remoteJid.replace(/@s\.whatsapp\.net$/, '');
    const messageId = data.key.id;

    const jobData: MessageJobData = {
      instance,
      phoneNumber,
      message: text,
      messageId,
    };

    const queue = getMessageQueue();
    await queue.add('incoming-message', jobData, {
      jobId: `msg-${instance}-${messageId}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    return reply.send({ status: 'queued' });
  });
};

export default webhookRoutes;
