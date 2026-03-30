import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import prisma from '../../db/prisma.js';
import { getChannel } from '../../channels/channel.manager.js';
import { emitNewMessage, emitConversationUpdated } from '../../realtime/emitter.js';

const listQuerySchema = z.object({
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 50)),
  channel: z.string().optional(),
});

const sendMessageSchema = z.object({
  content: z.string(),
  instance: z.string(),
});

export default async function conversationsRoutes(fastify: FastifyInstance) {
  // GET /conversations?limit=50&channel=whatsapp
  fastify.get('/conversations', async (request) => {
    const query = listQuerySchema.parse(request.query);

    const where: Record<string, unknown> = {};
    if (query.channel) where.channel = query.channel;

    const conversations = await prisma.conversation.findMany({
      where,
      take: query.limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        lead: {
          select: {
            name: true,
            phone: true,
            stage: true,
            humanOverride: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return conversations;
  });

  // GET /conversations/:id/messages?limit=100&offset=0
  fastify.get('/conversations/:id/messages', async (request) => {
    const { id } = request.params as { id: string };
    const { limit: rawLimit, offset: rawOffset } = request.query as { limit?: string; offset?: string };
    const limit = Math.min(rawLimit ? parseInt(rawLimit, 10) : 100, 500);
    const offset = rawOffset ? parseInt(rawOffset, 10) : 0;

    const [conversation, messages, totalMessages] = await Promise.all([
      prisma.conversation.findUniqueOrThrow({
        where: { id },
        include: {
          lead: {
            select: { id: true, name: true, phone: true, humanOverride: true },
          },
        },
      }),
      prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.message.count({ where: { conversationId: id } }),
    ]);

    return {
      id: conversation.id,
      leadId: conversation.leadId,
      channel: conversation.channel,
      lead: conversation.lead,
      messages,
      totalMessages,
    };
  });

  // POST /conversations/:id/message — operator reply (multi-channel)
  fastify.post('/conversations/:id/message', async (request) => {
    const { id } = request.params as { id: string };
    const body = sendMessageSchema.parse(request.body);

    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id },
      include: { lead: true },
    });

    // Save message
    const message = await prisma.message.create({
      data: {
        conversationId: id,
        role: 'human',
        content: body.content,
      },
    });

    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    // Send via the appropriate channel (whatsapp, instagram, sms)
    if (conversation.lead?.phone) {
      try {
        const channel = getChannel(conversation.channel || 'whatsapp');
        await channel.sendText(conversation.lead.phone, body.instance, body.content);
      } catch (err) {
        console.error(`[conversations] Failed to send via ${conversation.channel}:`, err);
      }
    }

    // Real-time events
    emitNewMessage({ conversationId: id });
    emitConversationUpdated({ id });

    return message;
  });
}
