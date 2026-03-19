import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Seed default pipeline
  const existing = await prisma.pipeline.findFirst({ where: { name: 'Qualificacao' } });
  if (!existing) {
    await prisma.pipeline.create({
      data: {
        name: 'Qualificacao',
        stages: {
          create: [
            { name: 'Novo', order: 0 },
            { name: 'Em Qualificacao', order: 1 },
            { name: 'Qualificado', order: 2 },
            { name: 'Desqualificado', order: 3 },
          ],
        },
      },
    });
    console.log('Default pipeline seeded');
  }

  // Seed admin user
  const adminExists = await prisma.user.findUnique({ where: { email: 'admin@autoscar.com.br' } });
  if (!adminExists) {
    await prisma.user.create({
      data: {
        email: 'admin@autoscar.com.br',
        passwordHash: hashSync('autoscar2026', 10),
        name: 'Admin',
        role: 'admin',
      },
    });
    console.log('Admin user seeded');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
