-- AlterTable: Add nullable campaignCode field to Lead
-- Tags WhatsApp leads coming from Google Ads / YouTube Shorts ads with a campaign code.
-- Nullable, not part of the @@unique([phone, pipelineId, vehicleUrl]) index — preserves existing behavior.

ALTER TABLE "Lead" ADD COLUMN "campaignCode" TEXT;
