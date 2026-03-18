import type { FastifyPluginAsync } from 'fastify';
import { createInstance, listInstances, getQrCode } from '../../whatsapp/instance.service.js';

const instanceRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /instances — Create a new WhatsApp instance
  fastify.post<{ Body: { name: string } }>('/instances', async (request, reply) => {
    const { name } = request.body;

    if (!name || typeof name !== 'string') {
      return reply.status(400).send({ error: 'name is required' });
    }

    const instance = await createInstance(name);
    return reply.status(201).send(instance);
  });

  // GET /instances — List all instances
  fastify.get('/instances', async () => {
    return listInstances();
  });

  // GET /instances/:name/qr — Get QR code for instance
  fastify.get<{ Params: { name: string } }>('/instances/:name/qr', async (request) => {
    const { name } = request.params;
    const qrCode = await getQrCode(name);
    return { qrCode };
  });
};

export default instanceRoutes;
