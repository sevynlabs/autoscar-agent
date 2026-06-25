-- AlterTable WhatsAppInstance to support Cloud API
ALTER TABLE "WhatsAppInstance" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'evolution';
ALTER TABLE "WhatsAppInstance" ADD COLUMN "phoneNumberId" TEXT;
ALTER TABLE "WhatsAppInstance" ADD COLUMN "businessAccountId" TEXT;
ALTER TABLE "WhatsAppInstance" ADD COLUMN "accessToken" TEXT;

-- Make evolutionInstanceId optional
ALTER TABLE "WhatsAppInstance" ALTER COLUMN "evolutionInstanceId" DROP NOT NULL;
