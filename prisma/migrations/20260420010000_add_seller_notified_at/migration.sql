-- AlterTable: track whether the sellers group has already been notified about
-- this lead, so we don't double-notify when the agent hits a terminal stage
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "sellerNotifiedAt" TIMESTAMP(3);
