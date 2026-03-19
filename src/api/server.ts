import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import envPlugin from './plugins/env.js';
import authPlugin from './plugins/auth.js';
import { socketPlugin } from './plugins/socket.js';
import instanceRoutes from './routes/instance.js';
import webhookRoutes from './routes/webhook.js';
import scraperRoutes from './routes/scraper.js';
import leadsRoutes from './routes/leads.js';
import pipelinesRoutes from './routes/pipelines.js';
import conversationsRoutes from './routes/conversations.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import instagramWebhookRoutes from './routes/instagram-webhook.js';
import dashboardRoutes from './routes/dashboard.js';
import externalApiRoutes from './routes/external-api.js';
import webhooksConfigRoutes from './routes/webhooks.js';
import agentConfigRoutes from './routes/agent-config.js';
import agentsRoutes from './routes/agents.js';
import followupWorkflowRoutes from './routes/followup-workflow.js';

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

  // Auth plugin — JWT verification on all routes except public
  await fastify.register(authPlugin);

  // Socket.IO real-time plugin
  await fastify.register(socketPlugin);

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // Auth routes (public)
  await fastify.register(authRoutes);

  // Instance management routes
  await fastify.register(instanceRoutes);

  // Webhook routes (public — Evolution API + Instagram)
  await fastify.register(webhookRoutes);
  await fastify.register(instagramWebhookRoutes);

  // Scraper test routes
  await fastify.register(scraperRoutes);

  // CRM API routes
  await fastify.register(leadsRoutes);
  await fastify.register(pipelinesRoutes);
  await fastify.register(conversationsRoutes);

  // User management routes (admin only)
  await fastify.register(usersRoutes);

  // Agent config + stats + CRUD
  await fastify.register(agentConfigRoutes);
  await fastify.register(agentsRoutes);

  // Follow-up workflow
  await fastify.register(followupWorkflowRoutes);

  // Dashboard analytics
  await fastify.register(dashboardRoutes);

  // Webhook configuration
  await fastify.register(webhooksConfigRoutes);

  // External API (API key auth, separate from JWT)
  await fastify.register(externalApiRoutes);

  return fastify;
}
