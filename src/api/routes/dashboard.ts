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

    // Run independent queries in parallel instead of sequentially
    const [leadsByStage, totalLeads, lastStage, messageStats, leadsWithConversation, leadsPerDayRaw] = await Promise.all([
      // Lead count by stage
      prisma.lead.groupBy({
        by: ['stageId'],
        _count: true,
        where,
      }),
      // Total leads
      prisma.lead.count({ where }),
      // Last stage for conversion rate
      prisma.stage.findFirst({ orderBy: { order: 'desc' } }),
      // Agent message count
      prisma.message.aggregate({
        _count: true,
        where: { role: 'agent', ...(from || to ? { createdAt: dateFilter } : {}) },
      }),
      // Conversations count
      prisma.conversation.count({ where }),
      // Leads per day — use raw SQL groupBy instead of loading all leads into memory
      prisma.$queryRawUnsafe<Array<{ day: string; count: bigint }>>(
        `SELECT DATE("createdAt") as day, COUNT(*)::bigint as count FROM "Lead"
         ${from || to ? `WHERE "createdAt" ${from ? `>= '${new Date(from).toISOString()}'` : ''} ${from && to ? 'AND' : ''} ${to ? `<= '${new Date(to).toISOString()}'` : ''}` : ''}
         GROUP BY DATE("createdAt") ORDER BY day ASC`
      ),
    ]);

    // Resolve stage names
    const stageIds = leadsByStage.map(l => l.stageId).filter(Boolean) as string[];
    const stages = stageIds.length > 0
      ? await prisma.stage.findMany({ where: { id: { in: stageIds } } })
      : [];
    const stageMap = new Map(stages.map(s => [s.id, s.name]));

    const leadsByStageNamed = leadsByStage.map(l => ({
      stage: l.stageId ? stageMap.get(l.stageId) ?? 'Sem etapa' : 'Sem etapa',
      count: l._count,
    }));

    // Conversion rate
    const qualifiedCount = lastStage
      ? await prisma.lead.count({ where: { ...where, stageId: lastStage.id } })
      : 0;
    const conversionRate = totalLeads > 0 ? (qualifiedCount / totalLeads) * 100 : 0;

    // Avg messages per lead
    const avgMessagesPerLead = leadsWithConversation > 0
      ? messageStats._count / leadsWithConversation
      : 0;

    return {
      totalLeads,
      qualifiedCount,
      conversionRate: Math.round(conversionRate * 10) / 10,
      avgMessagesPerLead: Math.round(avgMessagesPerLead * 10) / 10,
      leadsByStage: leadsByStageNamed,
      leadsPerDay: leadsPerDayRaw.map(r => ({
        date: typeof r.day === 'string' ? r.day : new Date(r.day as any).toISOString().split('T')[0],
        count: Number(r.count),
      })),
    };
  });
}
