import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.pipeline.findFirst({ where: { name: 'Qualificacao' } });
  if (existing) {
    console.log('Default pipeline already exists');
    return;
  }

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

main().catch(console.error).finally(() => prisma.$disconnect());
