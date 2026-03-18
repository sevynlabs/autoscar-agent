import { Redis } from 'ioredis';
import type { Vehicle } from './vehicle.schema.js';

const CACHE_TTL_SECONDS = 3600; // 1 hour

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    const url = process.env['REDIS_URL'] || 'redis://localhost:6379';
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redisClient;
}

function cacheKey(url: string): string {
  return `vehicle:${Buffer.from(url).toString('base64')}`;
}

export async function getCachedVehicle(url: string): Promise<Vehicle | null> {
  const client = getRedisClient();
  const key = cacheKey(url);
  const raw = await client.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as Vehicle;
}

export async function cacheVehicle(url: string, data: Vehicle): Promise<void> {
  const client = getRedisClient();
  const key = cacheKey(url);
  await client.set(key, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
}
