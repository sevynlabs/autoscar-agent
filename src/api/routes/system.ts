import { FastifyInstance } from 'fastify';
import { getAgentHealth, getAgentLogs } from '../../agent/agent-health.js';

export default async function systemRoutes(fastify: FastifyInstance) {
  // GET /system/agent-health — is the AI able to answer leads right now?
  fastify.get('/system/agent-health', async () => getAgentHealth());

  // GET /system/agent-logs?limit=200 — recent AI errors/warnings, newest first
  fastify.get('/system/agent-logs', async (request) => {
    const { limit } = request.query as { limit?: string };
    return { logs: await getAgentLogs(limit ? Number(limit) || 200 : 200) };
  });
}
