-- Drop old unique constraint
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_phone_pipelineId_key";

-- Add new unique constraint (phone + pipelineId + vehicleUrl)
CREATE UNIQUE INDEX "Lead_phone_pipelineId_vehicleUrl_key" ON "Lead"("phone", "pipelineId", "vehicleUrl");
