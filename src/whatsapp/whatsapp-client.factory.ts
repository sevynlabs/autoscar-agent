/**
 * WhatsApp Client Factory
 * Returns the appropriate adapter based on instance provider configuration
 */

import type { WhatsAppClient, WhatsAppProvider } from './whatsapp-client.interface.js';
import { EvolutionAdapter } from './adapters/evolution.adapter.js';
import { CloudApiAdapter } from './adapters/cloud-api.adapter.js';
import prisma from '../db/prisma.js';

// Cache of clients by instance name
const clientCache = new Map<string, WhatsAppClient>();

/**
 * Get a WhatsApp client for the given instance
 * Uses caching to avoid repeated DB lookups
 */
export async function getWhatsAppClient(instanceName: string): Promise<WhatsAppClient> {
  // Check cache first
  const cached = clientCache.get(instanceName);
  if (cached) {
    return cached;
  }

  // Lookup instance in database
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { name: instanceName },
  });

  if (!instance) {
    throw new Error(`WhatsApp instance not found: ${instanceName}`);
  }

  let client: WhatsAppClient;

  if (instance.provider === 'cloud_api') {
    if (!instance.accessToken || !instance.phoneNumberId) {
      throw new Error(`Cloud API instance ${instanceName} missing required credentials`);
    }
    client = new CloudApiAdapter({
      accessToken: instance.accessToken,
      phoneNumberId: instance.phoneNumberId,
    });
  } else {
    // Default to Evolution
    client = new EvolutionAdapter(instanceName);
  }

  // Cache the client
  clientCache.set(instanceName, client);

  return client;
}

/**
 * Get the provider type for an instance
 */
export async function getProviderForInstance(instanceName: string): Promise<WhatsAppProvider> {
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { name: instanceName },
    select: { provider: true },
  });

  if (!instance) {
    throw new Error(`WhatsApp instance not found: ${instanceName}`);
  }

  return (instance.provider as WhatsAppProvider) || 'evolution';
}

/**
 * Clear cached client for an instance
 * Call this when deleting an instance
 */
export function clearClientCache(instanceName: string): void {
  clientCache.delete(instanceName);
}

/**
 * Clear all cached clients
 */
export function clearAllClientCache(): void {
  clientCache.clear();
}
