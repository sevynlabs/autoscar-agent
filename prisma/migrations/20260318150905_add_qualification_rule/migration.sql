-- CreateTable
CREATE TABLE "QualificationRule" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "stageTrigger" TEXT NOT NULL,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualificationRule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "QualificationRule" ADD CONSTRAINT "QualificationRule_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
