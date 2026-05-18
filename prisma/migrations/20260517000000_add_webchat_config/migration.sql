-- AlterTable: web chat (Typebot-style /atendimento) configuration on the Agent
ALTER TABLE "Agent" ADD COLUMN "webchatEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Agent" ADD COLUMN "webchatTitle" TEXT;
ALTER TABLE "Agent" ADD COLUMN "webchatSubtitle" TEXT;
ALTER TABLE "Agent" ADD COLUMN "webchatBrandColor" TEXT;
ALTER TABLE "Agent" ADD COLUMN "webchatAvatarUrl" TEXT;
ALTER TABLE "Agent" ADD COLUMN "webchatWelcome" TEXT;
