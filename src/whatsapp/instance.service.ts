import { evolutionClient } from './evolution.client.js';
import prisma from '../db/prisma.js';

export async function createInstance(name: string) {
  const result = await evolutionClient.createInstance(name);

  const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.APP_PORT || 3000}`;
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
  return prisma.whatsAppInstance.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function getQrCode(name: string) {
  return evolutionClient.getQrCode(name);
}
