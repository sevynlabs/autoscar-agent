import { FastifyInstance } from 'fastify';
import prisma from '../../db/prisma.js';

/**
 * Normalize phone to digits only with Brazil country code
 */
function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length >= 10 && digits.length <= 12) {
    digits = '55' + digits.slice(1);
  }
  if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('55')) {
    digits = '55' + digits;
  }
  return digits;
}

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

  // ========== Seller Group Mappings ==========

  // GET /admin/seller-groups — List all seller-to-group mappings
  fastify.get('/admin/seller-groups', async () => {
    return prisma.sellerGroupMapping.findMany({
      orderBy: { createdAt: 'desc' },
    });
  });

  // POST /admin/seller-groups — Create a new seller-to-group mapping
  fastify.post<{
    Body: {
      sellerPhone: string;
      sellerName?: string;
      groupJid: string;
      groupName?: string;
    };
  }>('/admin/seller-groups', async (request, reply) => {
    const { sellerPhone, sellerName, groupJid, groupName } = request.body;

    if (!sellerPhone || !groupJid) {
      return reply.code(400).send({ error: 'sellerPhone and groupJid are required' });
    }

    const normalizedPhone = normalizePhone(sellerPhone);

    try {
      const mapping = await prisma.sellerGroupMapping.create({
        data: {
          sellerPhone: normalizedPhone,
          sellerName,
          groupJid,
          groupName,
        },
      });
      return reply.code(201).send(mapping);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.code(409).send({ error: 'Seller phone already mapped' });
      }
      throw err;
    }
  });

  // PUT /admin/seller-groups/:id — Update a mapping
  fastify.put<{
    Params: { id: string };
    Body: {
      sellerPhone?: string;
      sellerName?: string;
      groupJid?: string;
      groupName?: string;
    };
  }>('/admin/seller-groups/:id', async (request, reply) => {
    const { id } = request.params;
    const { sellerPhone, sellerName, groupJid, groupName } = request.body;

    const data: any = {};
    if (sellerPhone) data.sellerPhone = normalizePhone(sellerPhone);
    if (sellerName !== undefined) data.sellerName = sellerName;
    if (groupJid) data.groupJid = groupJid;
    if (groupName !== undefined) data.groupName = groupName;

    try {
      const mapping = await prisma.sellerGroupMapping.update({
        where: { id },
        data,
      });
      return mapping;
    } catch (err: any) {
      if (err.code === 'P2025') {
        return reply.code(404).send({ error: 'Mapping not found' });
      }
      throw err;
    }
  });

  // DELETE /admin/seller-groups/:id — Delete a mapping
  fastify.delete<{ Params: { id: string } }>('/admin/seller-groups/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      await prisma.sellerGroupMapping.delete({ where: { id } });
      return { deleted: true };
    } catch (err: any) {
      if (err.code === 'P2025') {
        return reply.code(404).send({ error: 'Mapping not found' });
      }
      throw err;
    }
  });
}
