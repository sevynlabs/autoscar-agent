import { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { randomBytes } from 'crypto';

export default async function webhooksRoutes(fastify: FastifyInstance) {
  // GET /webhooks
  fastify.get('/webhooks', async () => {
    return prisma.webhookEndpoint.findMany({ orderBy: { createdAt: 'desc' } });
  });

  // POST /webhooks
  fastify.post('/webhooks', async (request) => {
    const { url, events } = request.body as { url: string; events: string[] };
    const secret = randomBytes(32).toString('hex');

    return prisma.webhookEndpoint.create({
      data: { url, events, secret },
    });
  });

  // DELETE /webhooks/:id
  fastify.delete('/webhooks/:id', async (request) => {
    const { id } = request.params as { id: string };
    await prisma.webhookEndpoint.delete({ where: { id } });
    return { deleted: true };
  });

  // PATCH /webhooks/:id
  fastify.patch('/webhooks/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { url, events, active } = request.body as { url?: string; events?: string[]; active?: boolean };

    return prisma.webhookEndpoint.update({
      where: { id },
      data: { ...(url && { url }), ...(events && { events }), ...(active !== undefined && { active }) },
    });
  });
}
