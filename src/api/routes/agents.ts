import { FastifyInstance } from 'fastify';
import prisma from '../../db/prisma.js';

export default async function agentsRoutes(fastify: FastifyInstance) {
  // GET /agents — list all agents
  fastify.get('/agents', async () => {
    return prisma.agent.findMany({ orderBy: { createdAt: 'desc' } });
  });

  // GET /agents/:id
  fastify.get('/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    return agent;
  });

  // POST /agents — create
  fastify.post('/agents', async (request, reply) => {
    const body = request.body as {
      name: string;
      description?: string;
      model?: string;
      systemPrompt: string;
      welcomeMessage?: string;
      qualificationFields?: string[];
      channels?: string[];
      instances?: string[];
      portalUrl?: string;
      triggerVehicleUrls?: string[];
      triggerVehicleCodes?: string[];
      sellersGroupJid?: string;
      temperature?: number;
    };

    try {
      return await prisma.agent.create({
        data: {
          name: body.name,
          description: body.description || null,
          model: body.model ?? 'gpt-4o',
          systemPrompt: body.systemPrompt,
          welcomeMessage: body.welcomeMessage || null,
          qualificationFields: body.qualificationFields ?? ['interest', 'creditStatus', 'city', 'paymentMethod'],
          channels: body.channels ?? ['whatsapp', 'instagram', 'sms'],
          instances: body.instances ?? [],
          portalUrl: body.portalUrl || 'https://www.autoscar.com.br',
          triggerVehicleUrls: body.triggerVehicleUrls ?? [],
          triggerVehicleCodes: body.triggerVehicleCodes ?? [],
          sellersGroupJid: body.sellersGroupJid || null,
          temperature: body.temperature ?? 0.7,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      fastify.log.error({ err }, 'Failed to create agent');
      return reply.code(500).send({ error: 'Failed to create agent', detail: message });
    }
  });

  // PATCH /agents/:id — update
  fastify.patch('/agents/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const allowed = ['name', 'description', 'model', 'systemPrompt', 'welcomeMessage',
      'qualificationFields', 'channels', 'instances', 'portalUrl',
      'triggerVehicleUrls', 'triggerVehicleCodes', 'sellersGroupJid', 'temperature', 'active',
      'webchatEnabled', 'webchatTitle', 'webchatSubtitle', 'webchatBrandColor',
      'webchatAvatarUrl', 'webchatWelcome'];

    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key];
    }

    return prisma.agent.update({ where: { id }, data });
  });

  // DELETE /agents/:id
  fastify.delete('/agents/:id', async (request) => {
    const { id } = request.params as { id: string };
    await prisma.agent.delete({ where: { id } });
    return { deleted: true };
  });

  // GET /agents/active — get active agent (used by message worker)
  fastify.get('/agents/active', async () => {
    const agent = await prisma.agent.findFirst({
      where: { active: true },
      orderBy: { updatedAt: 'desc' },
    });
    return agent;
  });
}
