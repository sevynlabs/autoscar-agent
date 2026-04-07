-- AlterTable: Convert triggerVehicleUrl (single text) to triggerVehicleUrls (text array)
-- First add the new column
ALTER TABLE "Agent" ADD COLUMN "triggerVehicleUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Migrate existing data: copy single URL into the array
UPDATE "Agent" SET "triggerVehicleUrls" = ARRAY["triggerVehicleUrl"] WHERE "triggerVehicleUrl" IS NOT NULL AND "triggerVehicleUrl" != '';

-- Drop the old column
ALTER TABLE "Agent" DROP COLUMN "triggerVehicleUrl";
