-- AlterTable: dedicated WhatsApp number to notify (alternative/in addition to
-- the sellers group). Lets the lead be sent to a phone, not only a group JID.
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "sellersPhone" TEXT;
