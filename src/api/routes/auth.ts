import { FastifyInstance } from 'fastify';
import prisma from '../../db/prisma.js';
import { createToken, verifyToken } from '../plugins/auth.js';
import bcrypt from 'bcrypt';

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/login
  fastify.post('/auth/login', async (request, reply) => {
    try {
      const { email, password } = request.body as { email: string; password: string };

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return reply.code(401).send({ error: 'Credenciais inválidas' });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return reply.code(401).send({ error: 'Credenciais inválidas' });

      const token = await createToken(user.id, user.role);

      return {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      fastify.log.error({ err }, 'Login failed');
      return reply.code(500).send({ error: 'Login failed', detail: message });
    }
  });

  // GET /auth/me — public route, so we verify the token manually
  fastify.get('/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const payload = await verifyToken(authHeader.slice(7));
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, name: true, role: true },
      });

      if (!user) return reply.code(404).send({ error: 'Usuário não encontrado' });
      return user;
    } catch {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  });
}
