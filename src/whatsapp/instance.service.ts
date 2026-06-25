import { evolutionClient } from './evolution.client.js';
import { clearClientCache } from './whatsapp-client.factory.js';
import prisma from '../db/prisma.js';

/**
 * Full autonomous setup — creates instance + webhook + all events in one go (Evolution API)
 */
export async function createInstance(name: string, webhookUrl?: string) {
  // 1. Create instance on Evolution API (Baileys mode)
  const result = await evolutionClient.createInstance(name);
  console.log(`[instance] Created ${name} on Evolution: ${result.instance.instanceId}`);

  // 2. Determine webhook URL
  const baseUrl = webhookUrl
    || process.env.WEBHOOK_URL
    || process.env.APP_PUBLIC_URL
    || process.env.APP_BASE_URL
    || `http://app:${process.env.APP_PORT || 3001}`;

  const fullWebhookUrl = `${baseUrl}/webhook/whatsapp`;

  // 3. Set webhook with ALL message events
  try {
    await evolutionClient.setWebhook(name, fullWebhookUrl);
    console.log(`[instance] Webhook set: ${fullWebhookUrl}`);
  } catch (err) {
    console.warn('[instance] Webhook setup failed:', err instanceof Error ? err.message : err);
  }

  // 4. Save to DB
  const instance = await prisma.whatsAppInstance.create({
    data: {
      name,
      provider: 'evolution',
      evolutionInstanceId: result.instance.instanceId,
      status: result.instance.status || 'created',
    },
  });

  return { ...instance, webhookUrl: fullWebhookUrl };
}

/**
 * Create a Cloud API instance (Meta WhatsApp Business API)
 */
export async function createCloudApiInstance(params: {
  name: string;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  phoneNumber?: string;
}) {
  const { name, phoneNumberId, businessAccountId, accessToken, phoneNumber } = params;

  // Check if instance already exists
  const existing = await prisma.whatsAppInstance.findUnique({ where: { name } });
  if (existing) {
    throw new Error(`Instance with name "${name}" already exists`);
  }

  // Save to DB
  const instance = await prisma.whatsAppInstance.create({
    data: {
      name,
      provider: 'cloud_api',
      phoneNumberId,
      businessAccountId,
      accessToken,
      phoneNumber,
      status: 'connected', // Cloud API is always connected if credentials are valid
    },
  });

  console.log(`[instance] Created Cloud API instance: ${name}`);

  return instance;
}

/**
 * List instances with live status from Evolution API
 */
export async function listInstances() {
  const dbInstances = await prisma.whatsAppInstance.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const enriched = await Promise.all(
    dbInstances.map(async (inst) => {
      // Only check Evolution API for Evolution instances
      if (inst.provider === 'evolution') {
        try {
          const state = await evolutionClient.getConnectionState(inst.name);
          const status = state === 'open' ? 'connected' : state;
          if (status !== inst.status) {
            await prisma.whatsAppInstance.update({
              where: { id: inst.id },
              data: { status },
            });
          }
          return { ...inst, status };
        } catch {
          return inst;
        }
      }
      // Cloud API instances - just return as-is
      return inst;
    }),
  );

  return enriched;
}

/**
 * Get instance details by name
 */
export async function getInstance(name: string) {
  return prisma.whatsAppInstance.findUnique({
    where: { name },
  });
}

export async function getQrCode(name: string) {
  return evolutionClient.getQrCode(name);
}

export async function deleteInstance(name: string) {
  const instance = await prisma.whatsAppInstance.findUnique({ where: { name } });

  if (instance?.provider === 'evolution') {
    try {
      await evolutionClient.deleteInstance(name);
    } catch {}
  }

  // Clear cached client
  clearClientCache(name);

  await prisma.whatsAppInstance.deleteMany({ where: { name } });
}

export async function getConnectionState(name: string) {
  const instance = await prisma.whatsAppInstance.findUnique({ where: { name } });

  if (!instance) {
    return 'not_found';
  }

  if (instance.provider === 'cloud_api') {
    return 'connected'; // Cloud API doesn't have connection states
  }

  return evolutionClient.getConnectionState(name);
}

/**
 * Reconfigure webhook on existing instance (useful when URL changes)
 */
export async function reconfigureWebhook(name: string, webhookUrl: string) {
  const instance = await prisma.whatsAppInstance.findUnique({ where: { name } });

  if (!instance) {
    throw new Error(`Instance not found: ${name}`);
  }

  if (instance.provider === 'cloud_api') {
    // Cloud API webhooks are configured in Meta Developer Console
    return {
      url: null,
      message: 'Cloud API webhooks must be configured in Meta Developer Console',
    };
  }

  const fullUrl = `${webhookUrl}/webhook/whatsapp`;
  await evolutionClient.setWebhook(name, fullUrl);
  console.log(`[instance] Webhook reconfigured for ${name}: ${fullUrl}`);
  return { url: fullUrl };
}

/**
 * Update Cloud API instance credentials
 */
export async function updateCloudApiCredentials(
  name: string,
  credentials: {
    phoneNumberId?: string;
    businessAccountId?: string;
    accessToken?: string;
  }
) {
  const instance = await prisma.whatsAppInstance.findUnique({ where: { name } });

  if (!instance) {
    throw new Error(`Instance not found: ${name}`);
  }

  if (instance.provider !== 'cloud_api') {
    throw new Error(`Instance ${name} is not a Cloud API instance`);
  }

  // Clear cache so new credentials are used
  clearClientCache(name);

  return prisma.whatsAppInstance.update({
    where: { name },
    data: credentials,
  });
}
