import type { FastifyPluginAsync } from 'fastify';
import {
  createInstance,
  createCloudApiInstance,
  listInstances,
  getQrCode,
  deleteInstance,
  getConnectionState,
  reconfigureWebhook,
  getInstance,
  updateCloudApiCredentials,
} from '../../whatsapp/instance.service.js';
import { evolutionClient } from '../../whatsapp/evolution.client.js';
import prisma from '../../db/prisma.js';

const instanceRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /instances — Full autonomous setup for Evolution API (create + webhook + events)
  fastify.post<{ Body: { name: string; webhookUrl?: string } }>('/instances', async (request, reply) => {
    const { name, webhookUrl } = request.body;
    if (!name || typeof name !== 'string') {
      return reply.status(400).send({ error: 'name is required' });
    }
    try {
      const instance = await createInstance(name, webhookUrl);
      return reply.status(201).send(instance);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message ?? 'Failed to create instance' });
    }
  });

  // POST /instances/cloud-api — Create Cloud API instance
  fastify.post<{
    Body: {
      name: string;
      phoneNumberId: string;
      businessAccountId: string;
      accessToken: string;
      phoneNumber?: string;
    }
  }>('/instances/cloud-api', async (request, reply) => {
    const { name, phoneNumberId, businessAccountId, accessToken, phoneNumber } = request.body;

    if (!name || !phoneNumberId || !businessAccountId || !accessToken) {
      return reply.status(400).send({
        error: 'name, phoneNumberId, businessAccountId, and accessToken are required',
      });
    }

    try {
      const instance = await createCloudApiInstance({
        name,
        phoneNumberId,
        businessAccountId,
        accessToken,
        phoneNumber,
      });
      return reply.status(201).send(instance);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message ?? 'Failed to create Cloud API instance' });
    }
  });

  // GET /instances — List all instances with live status
  fastify.get('/instances', async () => {
    return listInstances();
  });

  // GET /instances/:name — Get instance details
  fastify.get<{ Params: { name: string } }>('/instances/:name', async (request, reply) => {
    const { name } = request.params;
    const instance = await getInstance(name);

    if (!instance) {
      return reply.status(404).send({ error: 'Instance not found' });
    }

    // Enrich with connection state
    const state = await getConnectionState(name);

    return {
      ...instance,
      connectionState: state,
      // Don't expose access token in API responses
      accessToken: instance.accessToken ? '***' : null,
    };
  });

  // GET /instances/:name/qr — Get QR code (Evolution only)
  fastify.get<{ Params: { name: string } }>('/instances/:name/qr', async (request, reply) => {
    const { name } = request.params;

    const instance = await getInstance(name);
    if (instance?.provider === 'cloud_api') {
      return reply.status(400).send({
        error: 'Cloud API instances do not use QR codes',
      });
    }

    try {
      const qrCode = await getQrCode(name);
      return { qrCode };
    } catch (err: any) {
      return reply.status(400).send({ error: 'QR code not available. Instance may already be connected.' });
    }
  });

  // GET /instances/:name/status — Connection state
  fastify.get<{ Params: { name: string } }>('/instances/:name/status', async (request) => {
    const { name } = request.params;
    const state = await getConnectionState(name);
    return { name, state };
  });

  // DELETE /instances/:name
  fastify.delete<{ Params: { name: string } }>('/instances/:name', async (request) => {
    const { name } = request.params;
    await deleteInstance(name);
    return { deleted: true };
  });

  // GET /instances/:name/info — Profile info (number, photo, name) - Evolution only
  fastify.get<{ Params: { name: string } }>('/instances/:name/info', async (request, reply) => {
    const { name } = request.params;

    const instance = await getInstance(name);
    if (instance?.provider === 'cloud_api') {
      return {
        profileName: name,
        phoneNumber: instance.phoneNumber || '',
        profilePictureUrl: null,
        provider: 'cloud_api',
      };
    }

    const info = await evolutionClient.getInstanceInfo(name);
    if (info.phoneNumber) {
      await prisma.whatsAppInstance.updateMany({
        where: { name },
        data: { phoneNumber: info.phoneNumber },
      });
    }
    return { ...info, provider: 'evolution' };
  });

  // POST /instances/:name/webhook — Reconfigure webhook URL
  fastify.post<{ Params: { name: string }; Body: { webhookUrl: string } }>(
    '/instances/:name/webhook',
    async (request) => {
      const { name } = request.params;
      const { webhookUrl } = request.body;
      return reconfigureWebhook(name, webhookUrl);
    },
  );

  // PATCH /instances/:name/credentials — Update Cloud API credentials
  fastify.patch<{
    Params: { name: string };
    Body: {
      phoneNumberId?: string;
      businessAccountId?: string;
      accessToken?: string;
    }
  }>('/instances/:name/credentials', async (request, reply) => {
    const { name } = request.params;
    const credentials = request.body;

    try {
      const updated = await updateCloudApiCredentials(name, credentials);
      return {
        ...updated,
        accessToken: updated.accessToken ? '***' : null,
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /instances/:name/groups — List WhatsApp groups (Evolution only)
  fastify.get<{ Params: { name: string }; Querystring: { search?: string } }>(
    '/instances/:name/groups',
    async (request, reply) => {
      const { name } = request.params;

      const instance = await getInstance(name);
      if (instance?.provider === 'cloud_api') {
        return reply.status(400).send({
          error: 'Cloud API does not support group listing via this endpoint',
        });
      }

      const { search } = request.query as { search?: string };
      let groups = await evolutionClient.fetchGroups(name);
      if (search) {
        const term = search.toLowerCase();
        groups = groups.filter(g => g.subject.toLowerCase().includes(term));
      }
      return groups;
    },
  );

  // GET /instances/webhook-url — Get current webhook base URL
  fastify.get('/instances/webhook-url', async () => {
    return {
      webhookUrl: process.env.WEBHOOK_URL || process.env.APP_PUBLIC_URL || process.env.APP_BASE_URL || null,
      configured: !!(process.env.WEBHOOK_URL || process.env.APP_PUBLIC_URL),
    };
  });

  // GET /instances/:name/webhook/diagnose — Check current webhook config and suggest fixes (Evolution only)
  fastify.get<{ Params: { name: string } }>(
    '/instances/:name/webhook/diagnose',
    async (request, reply) => {
      const { name } = request.params;

      const instance = await getInstance(name);
      if (instance?.provider === 'cloud_api') {
        return {
          provider: 'cloud_api',
          message: 'Cloud API webhooks are managed in Meta Developer Console',
          webhookUrl: `${process.env.APP_PUBLIC_URL || process.env.WEBHOOK_URL}/webhook/cloud-api`,
        };
      }

      const current = await evolutionClient.getWebhook(name);
      const expectedUrl = `${process.env.WEBHOOK_URL || process.env.APP_PUBLIC_URL || process.env.APP_BASE_URL}/webhook/whatsapp`;
      const requiredEvents = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];

      const issues: string[] = [];

      if (!current) {
        issues.push('Webhook não encontrado na Evolution API');
      } else {
        if (!current.enabled) {
          issues.push('Webhook está desabilitado');
        }
        if (!current.url) {
          issues.push('URL do webhook não está configurada');
        } else if (!current.url.includes('/webhook/whatsapp')) {
          issues.push(`URL do webhook está incorreta: ${current.url}`);
        }
        for (const event of requiredEvents) {
          if (!current.events.includes(event)) {
            issues.push(`Evento ${event} não está configurado`);
          }
        }
      }

      return {
        current,
        expected: {
          url: expectedUrl,
          events: requiredEvents,
        },
        issues,
        needsFix: issues.length > 0,
      };
    },
  );

  // POST /instances/:name/webhook/fix — Reconfigure webhook with correct settings (Evolution only)
  fastify.post<{ Params: { name: string } }>(
    '/instances/:name/webhook/fix',
    async (request, reply) => {
      const { name } = request.params;

      const instance = await getInstance(name);
      if (instance?.provider === 'cloud_api') {
        return reply.status(400).send({
          error: 'Cloud API webhooks are managed in Meta Developer Console',
        });
      }

      const baseUrl = process.env.WEBHOOK_URL || process.env.APP_PUBLIC_URL || process.env.APP_BASE_URL;

      if (!baseUrl) {
        return { error: 'WEBHOOK_URL ou APP_PUBLIC_URL não está configurado nas variáveis de ambiente' };
      }

      const fullUrl = `${baseUrl}/webhook/whatsapp`;
      await evolutionClient.setWebhook(name, fullUrl);

      // Verify the fix
      const updated = await evolutionClient.getWebhook(name);

      return {
        fixed: true,
        webhookUrl: fullUrl,
        current: updated,
      };
    },
  );
};

export default instanceRoutes;
