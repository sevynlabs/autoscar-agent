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
import followupConfigRoutes from './routes/followup-config.js';
import reengagementRoutes from './routes/reengagement.js';
import adminRoutes from './routes/admin.js';
import webchatRoutes from './routes/webchat.js';

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
    connectionTimeout: 30_000,  // 30s to establish connection
    requestTimeout: 60_000,     // 60s max per request
  });

  // Register env validation plugin — fails fast if required vars are missing
  await fastify.register(envPlugin);

  // CORS — must be registered BEFORE routes
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // Rate limiting — 100 requests per minute globally (except webhooks)
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: (req) => {
      const url = req.url ?? '';
      // Exclude webhooks and health checks from rate limiting
      return url.startsWith('/webhook') || url === '/health';
    },
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

  // Public web chat (Typebot-style /atendimento page)
  await fastify.register(webchatRoutes);

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
  await fastify.register(followupConfigRoutes);
  await fastify.register(reengagementRoutes);

  // Dashboard analytics
  await fastify.register(dashboardRoutes);

  // Webhook configuration
  await fastify.register(webhooksConfigRoutes);

  // Admin routes (CRM reset, etc.)
  await fastify.register(adminRoutes);

  // External API (API key auth, separate from JWT)
  await fastify.register(externalApiRoutes);

  return fastify;
}
