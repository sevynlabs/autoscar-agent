-- Record every lead → seller notification (one row per destination attempt)

CREATE TABLE IF NOT EXISTS "SellerNotificationLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "leadName" TEXT,
    "leadPhone" TEXT,
    "vehicleUrl" TEXT,
    "sellerName" TEXT,
    "sellerPhone" TEXT,
    "sellerEmail" TEXT,
    "groupJid" TEXT,
    "groupName" TEXT,
    "destination" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL,
    "channel" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerNotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SellerNotificationLog_createdAt_idx" ON "SellerNotificationLog"("createdAt");
CREATE INDEX IF NOT EXISTS "SellerNotificationLog_leadId_idx" ON "SellerNotificationLog"("leadId");
CREATE INDEX IF NOT EXISTS "SellerNotificationLog_sellerName_idx" ON "SellerNotificationLog"("sellerName");

DO $$ BEGIN
    ALTER TABLE "SellerNotificationLog" ADD CONSTRAINT "SellerNotificationLog_leadId_fkey"
        FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
