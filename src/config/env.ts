export interface EnvConfig {
  APP_PORT: number;
  NODE_ENV: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  EVOLUTION_API_URL: string;
  EVOLUTION_API_KEY: string;
  OPENAI_API_KEY: string;
  MINIO_ENDPOINT: string;
  MINIO_USER: string;
  MINIO_PASSWORD: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: EnvConfig;
  }
}
