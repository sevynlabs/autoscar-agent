import type { FastifyInstance } from 'fastify';
import {
  getVehicleData,
  ScraperValidationError,
  ScraperNavigationError,
} from '../../scraper/scraper.service.js';

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
    } catch (err) {
      if (err instanceof Error && err.message === 'URL must be from autoscar.com.br') {
        return reply.status(400).send({ error: 'URL must be from autoscar.com.br' });
      }

      if (err instanceof ScraperValidationError) {
        return reply.status(422).send({
          error: err.message,
          fields: err.fields,
        });
      }

      if (err instanceof ScraperNavigationError) {
        return reply.status(502).send({
          error: err.message,
        });
      }

      // Unexpected error
      request.log.error(err, 'Unexpected scraper error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
