import prisma from '../db/prisma.js';

const SINGLETON_ID = 'singleton';

export interface FollowupConfigData {
  enabled: boolean;
  maxAttempts: number;
  minHoursBetween: number;
  scanHour: number;
  scanMinute: number;
  skipWeekends: boolean;
  skipIfLeadResponded: boolean;
  useAgentPrompt: boolean;
  customPromptTemplate: string | null;
  exhaustedStageName: string;
}

export async function getFollowupConfig() {
  const existing = await prisma.followupConfig.findUnique({ where: { id: SINGLETON_ID } });
  if (existing) return existing;

  return prisma.followupConfig.create({ data: { id: SINGLETON_ID } });
}

export async function updateFollowupConfig(data: Partial<FollowupConfigData>) {
  await getFollowupConfig();
  return prisma.followupConfig.update({
    where: { id: SINGLETON_ID },
    data,
  });
}

export function buildScanCron(hour: number, minute: number, skipWeekends: boolean) {
  const h = Math.max(0, Math.min(23, hour));
  const m = Math.max(0, Math.min(59, minute));
  const dow = skipWeekends ? '1-5' : '*';
  return `${m} ${h} * * ${dow}`;
}
