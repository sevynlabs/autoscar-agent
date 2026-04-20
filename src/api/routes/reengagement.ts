import { FastifyInstance } from 'fastify';
import { forceQualifyAllNovo } from '../../queue/workers/reengagement.worker.js';

export default async function reengagementRoutes(fastify: FastifyInstance) {
  // One-shot: force-qualify every lead currently in "Novo" stage, fetching
  // missing names from WhatsApp profile and notifying the sellers group.
  fastify.post('/reengagement/force-qualify-all', async () => {
    const result = await forceQualifyAllNovo();
    return result;
  });
}
