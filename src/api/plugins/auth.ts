import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { jwtVerify, SignJWT } from 'jose';

const JWT_SECRET_KEY = () => new TextEncoder().encode(process.env.JWT_SECRET || 'autoscar-dev-secret-change-me');

export async function createToken(
  userId: string,
  role: string,
  remember = false,
): Promise<string> {
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(remember ? '30d' : '24h')
    .sign(JWT_SECRET_KEY());
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, JWT_SECRET_KEY());
  return payload as { sub: string; role: string };
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userRole?: string;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('userId', undefined);
  fastify.decorateRequest('userRole', undefined);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for public routes
    const publicPaths = ['/health', '/auth/login', '/auth/me', '/webhook/', '/webchat/', '/external/', '/instances', '/scraper/'];
    if (publicPaths.some(p => request.url.startsWith(p))) return;

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    try {
      const token = authHeader.slice(7);
      const payload = await verifyToken(token);
      request.userId = payload.sub;
      request.userRole = payload.role;
    } catch {
      reply.code(401).send({ error: 'Invalid token' });
    }
  });
}

export default fp(authPlugin, { name: 'auth' });
