import type { FastifyPluginAsync } from 'fastify';
import { createInstance, listInstances, getQrCode, deleteInstance, getConnectionState } from '../../whatsapp/instance.service.js';
import { evolutionClient } from '../../whatsapp/evolution.client.js';
import prisma from '../../db/prisma.js';

const instanceRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /instances — Create a new WhatsApp instance (Baileys mode)
  fastify.post<{ Body: { name: string } }>('/instances', async (request, reply) => {
    const { name } = request.body;
    if (!name || typeof name !== 'string') {
      return reply.status(400).send({ error: 'name is required' });
    }
    try {
      const instance = await createInstance(name);
      return reply.status(201).send(instance);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message ?? 'Failed to create instance' });
    }
  });

  // GET /instances — List all instances with live status
  fastify.get('/instances', async () => {
    return listInstances();
  });

  // GET /instances/:name/qr — Get QR code for instance
  fastify.get<{ Params: { name: string } }>('/instances/:name/qr', async (request, reply) => {
    const { name } = request.params;
    try {
      const qrCode = await getQrCode(name);
      return { qrCode };
    } catch (err: any) {
      return reply.status(400).send({ error: 'QR code not available. Instance may already be connected.' });
    }
  });

  // GET /instances/:name/status — Get connection state
  fastify.get<{ Params: { name: string } }>('/instances/:name/status', async (request) => {
    const { name } = request.params;
    const state = await getConnectionState(name);
    return { name, state };
  });

  // DELETE /instances/:name — Delete instance
  fastify.delete<{ Params: { name: string } }>('/instances/:name', async (request) => {
    const { name } = request.params;
    await deleteInstance(name);
    return { deleted: true };
  });

  // GET /instances/:name/info — Get profile info (number, photo, name)
  fastify.get<{ Params: { name: string } }>('/instances/:name/info', async (request) => {
    const { name } = request.params;
    const info = await evolutionClient.getInstanceInfo(name);
    // Update phone in DB if available
    if (info.phoneNumber) {
      await prisma.whatsAppInstance.updateMany({
        where: { name },
        data: { phoneNumber: info.phoneNumber },
      });
    }
    return info;
  });

  // GET /instances/:name/groups — List WhatsApp groups
  fastify.get<{ Params: { name: string }; Querystring: { search?: string } }>(
    '/instances/:name/groups',
    async (request) => {
      const { name } = request.params;
      const { search } = request.query as { search?: string };

      let groups = await evolutionClient.fetchGroups(name);

      if (search) {
        const term = search.toLowerCase();
        groups = groups.filter(g => g.subject.toLowerCase().includes(term));
      }

      return groups;
    },
  );
};

export default instanceRoutes;
