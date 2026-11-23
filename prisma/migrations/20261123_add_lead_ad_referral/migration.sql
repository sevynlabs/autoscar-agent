-- AlterTable: store the Meta click-to-WhatsApp ad referral on the lead so
-- conversations started from ads can be reconciled with Meta Ads Manager.
-- All nullable and outside the lead unique index — existing behavior unchanged.

ALTER TABLE "Lead" ADD COLUMN "adSourceId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "adSourceUrl" TEXT;
ALTER TABLE "Lead" ADD COLUMN "adHeadline" TEXT;
ALTER TABLE "Lead" ADD COLUMN "adCtwaClid" TEXT;
ALTER TABLE "Lead" ADD COLUMN "adClickedAt" TIMESTAMP(3);

CREATE INDEX "Lead_adClickedAt_idx" ON "Lead"("adClickedAt");
