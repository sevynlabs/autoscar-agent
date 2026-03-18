import type { FastifyPluginAsync } from 'fastify';
import { getMessageQueue } from '../../queue/queues.js';
import type { MessageJobData } from '../../queue/jobs/message.job.js';

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
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
  fastify.post<{ Body: EvolutionWebhookPayload }>('/webhook/whatsapp', async (request, reply) => {
    const { event, instance, data } = request.body;

    // Only process message events (Evolution v2 dot notation + legacy uppercase)
    if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') {
      return reply.send({ status: 'ignored', reason: 'not a message event' });
    }

    // Skip self-messages
    if (data.key.fromMe) {
      return reply.send({ status: 'ignored', reason: 'self message' });
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
      jobId: `${instance}-${phoneNumber}`,
      delay: 1000, // 1s debounce window
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    return reply.send({ status: 'queued' });
  });
};

export default webhookRoutes;
