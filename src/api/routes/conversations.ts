import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import prisma from '../../db/prisma.js';
import { evolutionClient } from '../../whatsapp/evolution.client.js';

const listQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 50)),
});

const sendMessageSchema = z.object({
  content: z.string(),
  instance: z.string(),
});

export default async function conversationsRoutes(fastify: FastifyInstance) {
  // GET /conversations?limit=50
  fastify.get('/conversations', async (request) => {
    const query = listQuerySchema.parse(request.query);

    const conversations = await prisma.conversation.findMany({
      take: query.limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        lead: {
          select: {
            name: true,
            phone: true,
            stage: true,
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

  // GET /conversations/:id/messages
  fastify.get('/conversations/:id/messages', async (request) => {
    const { id } = request.params as { id: string };

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });

    return messages;
  });

  // POST /conversations/:id/message — operator reply
  fastify.post('/conversations/:id/message', async (request) => {
    const { id } = request.params as { id: string };
    const body = sendMessageSchema.parse(request.body);

    // Get conversation with lead phone
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id },
      include: { lead: true },
    });

    // Create message record
    const message = await prisma.message.create({
      data: {
        conversationId: id,
        role: 'human',
        content: body.content,
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    // Send via WhatsApp
    if (conversation.lead?.phone) {
      await evolutionClient.sendText(
        body.instance,
        conversation.lead.phone,
        body.content,
      );
    }

    fastify.io.emit('message:new', message);

    return message;
  });
}
