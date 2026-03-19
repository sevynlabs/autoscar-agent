import { evolutionClient } from './evolution.client.js';
import prisma from '../db/prisma.js';

/**
 * Full autonomous setup — creates instance + webhook + all events in one go
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
      evolutionInstanceId: result.instance.instanceId,
      status: result.instance.status || 'created',
    },
  });

  return { ...instance, webhookUrl: fullWebhookUrl };
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
    }),
  );

  return enriched;
}

export async function getQrCode(name: string) {
  return evolutionClient.getQrCode(name);
}

export async function deleteInstance(name: string) {
  try { await evolutionClient.deleteInstance(name); } catch {}
  await prisma.whatsAppInstance.deleteMany({ where: { name } });
}

export async function getConnectionState(name: string) {
  return evolutionClient.getConnectionState(name);
}

/**
 * Reconfigure webhook on existing instance (useful when URL changes)
 */
export async function reconfigureWebhook(name: string, webhookUrl: string) {
  const fullUrl = `${webhookUrl}/webhook/whatsapp`;
  await evolutionClient.setWebhook(name, fullUrl);
  console.log(`[instance] Webhook reconfigured for ${name}: ${fullUrl}`);
  return { url: fullUrl };
}
