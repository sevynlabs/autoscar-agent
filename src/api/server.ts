import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import envPlugin from './plugins/env.js';
import { socketPlugin } from './plugins/socket.js';
import instanceRoutes from './routes/instance.js';
import webhookRoutes from './routes/webhook.js';
import scraperRoutes from './routes/scraper.js';
import leadsRoutes from './routes/leads.js';
import pipelinesRoutes from './routes/pipelines.js';
import conversationsRoutes from './routes/conversations.js';

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  // Register env validation plugin — fails fast if required vars are missing
  await fastify.register(envPlugin);

  // CORS — must be registered BEFORE routes
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // Rate limiting — 100 requests per minute globally
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Socket.IO real-time plugin
  await fastify.register(socketPlugin);

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // Instance management routes
  await fastify.register(instanceRoutes);

  // Webhook routes
  await fastify.register(webhookRoutes);

  // Scraper test routes
  await fastify.register(scraperRoutes);

  // CRM API routes
  await fastify.register(leadsRoutes);
  await fastify.register(pipelinesRoutes);
  await fastify.register(conversationsRoutes);

  return fastify;
}
