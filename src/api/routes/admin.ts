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

  // GET /admin/vehicle-seller?url=... — Lookup seller info for a vehicle URL
  fastify.get<{ Querystring: { url: string } }>('/admin/vehicle-seller', async (request, reply) => {
    const { url } = request.query;

    if (!url) {
      return reply.code(400).send({ error: 'url query parameter is required' });
    }

    try {
      const res = await fetch('https://dhqmwf73sb.execute-api.us-east-1.amazonaws.com/prd/advertisementLeads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadPhone: '5500000000000', // Dummy phone for lookup
          leadName: 'Consulta',
          link: url,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return reply.code(res.status).send({ error: 'API returned error', status: res.status });
      }

      const data = await res.json() as any;
      const seller = data.customer;

      if (!seller) {
        return { found: false, message: 'No seller found for this vehicle' };
      }

      const sellerPhoneNormalized = normalizePhone(seller.phone || '');

      // Check if seller has a group mapping
      const mapping = await prisma.sellerGroupMapping.findUnique({
        where: { sellerPhone: sellerPhoneNormalized },
      });

      return {
        found: true,
        seller: {
          name: seller.name,
          fantasyName: seller.fantasyName,
          companyName: seller.companyName,
          phone: seller.phone,
          phoneNormalized: sellerPhoneNormalized,
          email: seller.email,
        },
        hasGroupMapping: !!mapping,
        groupMapping: mapping || null,
      };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}
