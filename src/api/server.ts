import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import envPlugin from './plugins/env.js';
import instanceRoutes from './routes/instance.js';

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  // Register env validation plugin — fails fast if required vars are missing
  await fastify.register(envPlugin);

  // Rate limiting — 100 requests per minute globally
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // Instance management routes
  await fastify.register(instanceRoutes);

  return fastify;
}
