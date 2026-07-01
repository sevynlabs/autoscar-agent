-- AlterTable: Add sellerEmail field and make sellerPhone optional
-- Email takes priority over phone for more specific seller mapping

-- Remove unique constraint from sellerPhone
DROP INDEX IF EXISTS "SellerGroupMapping_sellerPhone_key";

-- Add sellerEmail column
ALTER TABLE "SellerGroupMapping" ADD COLUMN "sellerEmail" TEXT;

-- Make sellerPhone nullable
ALTER TABLE "SellerGroupMapping" ALTER COLUMN "sellerPhone" DROP NOT NULL;

-- Create unique index on sellerEmail
CREATE UNIQUE INDEX "SellerGroupMapping_sellerEmail_key" ON "SellerGroupMapping"("sellerEmail");

-- Create index on sellerPhone for faster lookups
CREATE INDEX "SellerGroupMapping_sellerPhone_idx" ON "SellerGroupMapping"("sellerPhone");
