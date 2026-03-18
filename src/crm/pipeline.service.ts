import prisma from '../db/prisma.js';

export async function getDefaultPipeline() {
  const pipeline = await prisma.pipeline.findFirst({
    include: { stages: { orderBy: { order: 'asc' } } },
  });

  if (!pipeline) {
    throw new Error('No pipeline found. Run "npx prisma db seed" first.');
  }

  return pipeline;
}

export async function getStageByName(pipelineId: string, name: string) {
  return prisma.stage.findFirst({
    where: { pipelineId, name },
  });
}
