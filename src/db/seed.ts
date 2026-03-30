import prisma from './prisma.js';
import bcrypt from 'bcrypt';

export async function ensureSeedData() {
  // Ensure default pipeline exists
  const pipeline = await prisma.pipeline.findFirst({ where: { name: 'Qualificacao' } });
  if (!pipeline) {
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
    console.log('[seed] Default pipeline created');
  }

  // Ensure admin user exists
  const admin = await prisma.user.findUnique({ where: { email: 'admin@autoscar.com.br' } });
  if (!admin) {
    await prisma.user.create({
      data: {
        email: 'admin@autoscar.com.br',
        passwordHash: await bcrypt.hash('autoscar2026', 10),
        name: 'Admin',
        role: 'admin',
      },
    });
    console.log('[seed] Admin user created');
  }
}
