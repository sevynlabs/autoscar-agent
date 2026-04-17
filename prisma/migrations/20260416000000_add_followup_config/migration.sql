-- CreateTable
CREATE TABLE "FollowupConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "minHoursBetween" INTEGER NOT NULL DEFAULT 20,
    "scanHour" INTEGER NOT NULL DEFAULT 9,
    "scanMinute" INTEGER NOT NULL DEFAULT 0,
    "skipWeekends" BOOLEAN NOT NULL DEFAULT false,
    "skipIfLeadResponded" BOOLEAN NOT NULL DEFAULT true,
    "useAgentPrompt" BOOLEAN NOT NULL DEFAULT true,
    "customPromptTemplate" TEXT,
    "exhaustedStageName" TEXT NOT NULL DEFAULT 'Desqualificado',
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowupConfig_pkey" PRIMARY KEY ("id")
);

-- Seed singleton row
INSERT INTO "FollowupConfig" ("id", "updatedAt")
VALUES ('singleton', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
