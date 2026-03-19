import { evolutionClient } from './evolution.client.js';
import prisma from '../db/prisma.js';

export async function createInstance(name: string) {
  const result = await evolutionClient.createInstance(name);

  const appBaseUrl = process.env.APP_BASE_URL || `http://app:${process.env.APP_PORT || 3001}`;
  await evolutionClient.setWebhook(name, `${appBaseUrl}/webhook/whatsapp`);

  const instance = await prisma.whatsAppInstance.create({
    data: {
      name,
      evolutionInstanceId: result.instance.instanceId,
      status: result.instance.status || 'created',
    },
  });

  return instance;
}

export async function listInstances() {
  const dbInstances = await prisma.whatsAppInstance.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Enrich with live connection state from Evolution API
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
  try { await evolutionClient.deleteInstance(name); } catch { /* may not exist */ }
  await prisma.whatsAppInstance.deleteMany({ where: { name } });
}

export async function getConnectionState(name: string) {
  return evolutionClient.getConnectionState(name);
}
