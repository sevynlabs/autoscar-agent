-- AlterTable: add parallel array of numeric codes (indexed alongside triggerVehicleUrls)
ALTER TABLE "Agent" ADD COLUMN "triggerVehicleCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
