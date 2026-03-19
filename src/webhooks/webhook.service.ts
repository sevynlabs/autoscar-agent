import { prisma } from '../db/prisma.js';
import { createHmac } from 'crypto';

export async function fireWebhooks(event: string, payload: Record<string, unknown>) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { active: true, events: { has: event } },
  });

  for (const endpoint of endpoints) {
    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const signature = createHmac('sha256', endpoint.secret).update(body).digest('hex');

    fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
      },
      body,
    }).catch(err => console.error(`[Webhook] Failed to fire ${event} to ${endpoint.url}:`, err));
  }
}
