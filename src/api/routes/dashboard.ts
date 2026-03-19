import { FastifyInstance } from 'fastify';
import prisma from '../../db/prisma.js';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  // GET /dashboard/stats?from=&to=
  fastify.get('/dashboard/stats', async (request) => {
    const { from, to } = request.query as { from?: string; to?: string };

    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    const where = from || to ? { createdAt: dateFilter } : {};

    // Lead count by stage
    const leadsByStage = await prisma.lead.groupBy({
      by: ['stageId'],
      _count: true,
      where,
    });

    // Resolve stage names
    const stageIds = leadsByStage.map(l => l.stageId).filter(Boolean) as string[];
    const stages = await prisma.stage.findMany({ where: { id: { in: stageIds } } });
    const stageMap = new Map(stages.map(s => [s.id, s.name]));

    const leadsByStageNamed = leadsByStage.map(l => ({
      stage: l.stageId ? stageMap.get(l.stageId) ?? 'Sem etapa' : 'Sem etapa',
      count: l._count,
    }));

    // Total leads
    const totalLeads = await prisma.lead.count({ where });

    // Conversion rate (leads in last stage / total)
    const lastStage = await prisma.stage.findFirst({ orderBy: { order: 'desc' } });
    const qualifiedCount = lastStage
      ? await prisma.lead.count({ where: { ...where, stageId: lastStage.id } })
      : 0;
    const conversionRate = totalLeads > 0 ? (qualifiedCount / totalLeads) * 100 : 0;

    // Agent performance: avg messages per lead
    const messageStats = await prisma.message.aggregate({
      _count: true,
      where: { role: 'agent', ...(from || to ? { createdAt: dateFilter } : {}) },
    });

    const leadsWithConversation = await prisma.conversation.count({ where });
    const avgMessagesPerLead = leadsWithConversation > 0
      ? messageStats._count / leadsWithConversation
      : 0;

    // Leads per day for chart
    const leads = await prisma.lead.findMany({
      where,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const leadsPerDay: Record<string, number> = {};
    for (const lead of leads) {
      const day = lead.createdAt.toISOString().split('T')[0];
      leadsPerDay[day] = (leadsPerDay[day] ?? 0) + 1;
    }

    return {
      totalLeads,
      qualifiedCount,
      conversionRate: Math.round(conversionRate * 10) / 10,
      avgMessagesPerLead: Math.round(avgMessagesPerLead * 10) / 10,
      leadsByStage: leadsByStageNamed,
      leadsPerDay: Object.entries(leadsPerDay).map(([date, count]) => ({ date, count })),
    };
  });
}
