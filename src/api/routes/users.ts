import { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';
import bcrypt from 'bcrypt';

export default async function usersRoutes(fastify: FastifyInstance) {
  // Admin guard
  const requireAdmin = async (request: any, reply: any) => {
    if (request.userRole !== 'admin') {
      return reply.code(403).send({ error: 'Admin required' });
    }
  };

  // GET /users
  fastify.get('/users', { preHandler: requireAdmin }, async () => {
    return prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  // POST /users
  fastify.post('/users', { preHandler: requireAdmin }, async (request) => {
    const { email, password, name, role } = request.body as {
      email: string; password: string; name: string; role?: string;
    };

    const passwordHash = await bcrypt.hash(password, 10);

    return prisma.user.create({
      data: { email, passwordHash, name, role: role ?? 'operator' },
      select: { id: true, email: true, name: true, role: true },
    });
  });

  // DELETE /users/:id
  fastify.delete('/users/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (id === request.userId) return reply.code(400).send({ error: 'Não pode excluir a si mesmo' });
    await prisma.user.delete({ where: { id } });
    return { deleted: true };
  });

  // PATCH /users/:id
  fastify.patch('/users/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = request.params as { id: string };
    const { name, role, password } = request.body as { name?: string; role?: string; password?: string };

    const data: any = {};
    if (name) data.name = name;
    if (role) data.role = role;
    if (password) data.passwordHash = await bcrypt.hash(password, 10);

    return prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true },
    });
  });
}
