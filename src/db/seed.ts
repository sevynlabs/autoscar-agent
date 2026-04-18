import prisma from './prisma.js';
import bcrypt from 'bcrypt';

async function ensureMigrations() {
  // Migrate triggerVehicleUrl (single text) -> triggerVehicleUrls (text array)
  try {
    const cols: Array<{ column_name: string }> = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Agent' AND column_name = 'triggerVehicleUrls'`;
    if (cols.length === 0) {
      await prisma.$executeRaw`ALTER TABLE "Agent" ADD COLUMN "triggerVehicleUrls" TEXT[] DEFAULT ARRAY[]::TEXT[]`;
      await prisma.$executeRaw`UPDATE "Agent" SET "triggerVehicleUrls" = ARRAY["triggerVehicleUrl"] WHERE "triggerVehicleUrl" IS NOT NULL AND "triggerVehicleUrl" != ''`;
      await prisma.$executeRaw`ALTER TABLE "Agent" DROP COLUMN IF EXISTS "triggerVehicleUrl"`;
      console.log('[seed] Migrated triggerVehicleUrl -> triggerVehicleUrls');
    }
  } catch (err) {
    console.log('[seed] Migration check skipped:', err instanceof Error ? err.message : err);
  }

  // Add triggerVehicleCodes column (parallel array to triggerVehicleUrls)
  try {
    const cols: Array<{ column_name: string }> = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Agent' AND column_name = 'triggerVehicleCodes'`;
    if (cols.length === 0) {
      await prisma.$executeRaw`ALTER TABLE "Agent" ADD COLUMN "triggerVehicleCodes" TEXT[] DEFAULT ARRAY[]::TEXT[]`;
      console.log('[seed] Added triggerVehicleCodes column');
    }
  } catch (err) {
    console.log('[seed] triggerVehicleCodes migration skipped:', err instanceof Error ? err.message : err);
  }
}

export async function ensureSeedData() {
  await ensureMigrations();

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
