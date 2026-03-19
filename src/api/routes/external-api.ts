import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../db/prisma.js';

async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers['x-api-key'] as string;
  if (!apiKey) return reply.code(401).send({ error: 'API key required' });

  const key = await prisma.apiKey.findUnique({ where: { key: apiKey } });
  if (!key) return reply.code(401).send({ error: 'Invalid API key' });
}

export default async function externalApiRoutes(fastify: FastifyInstance) {
  // GET /external/v1/leads
  fastify.get('/external/v1/leads', { preHandler: apiKeyAuth }, async (request) => {
    const { limit, offset, stageId } = request.query as { limit?: string; offset?: string; stageId?: string };
    const where: any = {};
    if (stageId) where.stageId = stageId;

    return prisma.lead.findMany({
      where,
      include: { stage: true, notes: { take: 5, orderBy: { createdAt: 'desc' } } },
      take: parseInt(limit ?? '50'),
      skip: parseInt(offset ?? '0'),
      orderBy: { createdAt: 'desc' },
    });
  });

  // GET /external/v1/leads/:id
  fastify.get('/external/v1/leads/:id', { preHandler: apiKeyAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { stage: true, notes: true, conversation: { include: { messages: true } } },
    });
    if (!lead) return reply.code(404).send({ error: 'Lead not found' });
    return lead;
  });

  // GET /external/v1/pipelines
  fastify.get('/external/v1/pipelines', { preHandler: apiKeyAuth }, async () => {
    return prisma.pipeline.findMany({ include: { stages: { orderBy: { order: 'asc' } } } });
  });
}
