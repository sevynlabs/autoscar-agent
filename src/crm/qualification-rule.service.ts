import prisma from '../db/prisma.js';

export async function listRules(pipelineId: string) {
  return prisma.qualificationRule.findMany({
    where: { pipelineId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createRule(data: {
  pipelineId: string;
  field: string;
  operator: string;
  value: string;
  stageTrigger: string;
}) {
  return prisma.qualificationRule.create({ data });
}

export async function deleteRule(ruleId: string) {
  return prisma.qualificationRule.delete({
    where: { id: ruleId },
  });
}
