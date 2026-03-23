import type { FastifyInstance } from 'fastify';
import { getVehicleData } from '../../scraper/scraper.service.js';

export default async function scraperRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: { url?: string };
  }>('/scraper/vehicle', async (request, reply) => {
    const { url } = request.query;

    if (!url) {
      return reply.status(400).send({ error: 'Missing required query parameter: url' });
    }

    try {
      const result = await getVehicleData(url);
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(502).send({ error: err.message ?? 'Vehicle not found' });
    }
  });
}
