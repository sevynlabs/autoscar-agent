-- AlterTable: web chat (Typebot-style /atendimento) configuration on the Agent
-- Idempotent so a re-run / partial apply never breaks the deploy.
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "webchatEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "webchatTitle" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "webchatSubtitle" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "webchatBrandColor" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "webchatAvatarUrl" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "webchatWelcome" TEXT;
