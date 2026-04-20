-- AlterTable: track active re-engagement attempts for leads in "Novo" stage
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "reengagementAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lastReengagementAt" TIMESTAMP(3);
