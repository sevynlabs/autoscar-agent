-- AlterTable: real contact phone collected in the conversation. Kept separate
-- from `phone` because the web chat (/atendimento) uses `phone` as the
-- session routing key (web:<uuid>), so it must not be overwritten.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
