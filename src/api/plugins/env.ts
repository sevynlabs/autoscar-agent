import fastifyEnv from '@fastify/env';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const schema = {
  type: 'object' as const,
  required: [
    'APP_PORT',
    'DATABASE_URL',
    'REDIS_URL',
    'EVOLUTION_API_URL',
    'EVOLUTION_API_KEY',
    'OPENAI_API_KEY',
    'MINIO_ENDPOINT',
    'MINIO_USER',
    'MINIO_PASSWORD',
  ],
  properties: {
    APP_PORT: { type: 'number' as const, default: 3000 },
    NODE_ENV: { type: 'string' as const, default: 'development' },
    DATABASE_URL: { type: 'string' as const },
    REDIS_URL: { type: 'string' as const },
    EVOLUTION_API_URL: { type: 'string' as const },
    EVOLUTION_API_KEY: { type: 'string' as const },
    OPENAI_API_KEY: { type: 'string' as const },
    MINIO_ENDPOINT: { type: 'string' as const },
    MINIO_USER: { type: 'string' as const },
    MINIO_PASSWORD: { type: 'string' as const },
  },
};

const envPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyEnv, {
    confKey: 'config',
    schema,
    dotenv: true,
  });
};

export default fp(envPlugin, { name: 'env' });
