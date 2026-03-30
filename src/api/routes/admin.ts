import { FastifyInstance } from 'fastify';
import prisma from '../../db/prisma.js';

export default async function adminRoutes(fastify: FastifyInstance) {
  // POST /admin/reset-crm — delete all messages, conversations, notes, leads
  fastify.post('/admin/reset-crm', async (request, reply) => {
    const { confirm } = request.body as { confirm?: string };
    if (confirm !== 'RESET') {
      return reply.code(400).send({ error: 'Send { "confirm": "RESET" } to proceed' });
    }

    // Delete in order respecting foreign keys
    const messages = await prisma.message.deleteMany({});
    const conversations = await prisma.conversation.deleteMany({});
    const notes = await prisma.leadNote.deleteMany({});
    const leads = await prisma.lead.deleteMany({});

    return {
      deleted: {
        messages: messages.count,
        conversations: conversations.count,
        notes: notes.count,
        leads: leads.count,
      },
    };
  });
}
