import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import ExcelJS from 'exceljs';
import prisma from '../../db/prisma.js';
import { updateLead, moveToStage, addNote } from '../../crm/lead.service.js';

const leadQuerySchema = z.object({
  pipelineId: z.string().optional(),
  stageId: z.string().optional(),
  search: z.string().optional(),
  humanOverride: z.enum(['true', 'false']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.string().optional().transform((v) => Math.min(v ? parseInt(v, 10) : 100, 500)),
  offset: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 0)),
});

const leadExportQuerySchema = z.object({
  pipelineId: z.string().optional(),
  stageId: z.string().optional(),
  search: z.string().optional(),
  humanOverride: z.enum(['true', 'false']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

function buildLeadWhere(q: {
  pipelineId?: string;
  stageId?: string;
  search?: string;
  humanOverride?: 'true' | 'false';
  dateFrom?: string;
  dateTo?: string;
}) {
  const where: Record<string, unknown> = {};
  if (q.pipelineId) where.pipelineId = q.pipelineId;
  if (q.stageId) where.stageId = q.stageId;
  if (q.humanOverride) where.humanOverride = q.humanOverride === 'true';
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { phone: { contains: q.search } },
      { contactPhone: { contains: q.search } },
      { email: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  if (q.dateFrom || q.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (q.dateFrom) createdAt.gte = new Date(q.dateFrom);
    if (q.dateTo) {
      const to = new Date(q.dateTo);
      to.setHours(23, 59, 59, 999);
      createdAt.lte = to;
    }
    where.createdAt = createdAt;
  }
  return where;
}

const patchLeadSchema = z.object({
  name: z.string().optional(),
  contactPhone: z.string().optional(),
  city: z.string().optional(),
  creditStatus: z.string().optional(),
  paymentMethod: z.string().optional(),
  vehicleUrl: z.string().optional(),
});

const moveSchema = z.object({
  stageId: z.string(),
});

const handoffSchema = z.object({
  override: z.boolean(),
});

const noteSchema = z.object({
  content: z.string(),
});

export default async function leadsRoutes(fastify: FastifyInstance) {
  // GET /leads?pipelineId=&stageId=&search=&humanOverride=&dateFrom=&dateTo=
  fastify.get('/leads', async (request, reply) => {
    const query = leadQuerySchema.parse(request.query);
    const where = buildLeadWhere(query);

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          stage: true,
          notes: { take: 1, orderBy: { createdAt: 'desc' } },
        },
        orderBy: { updatedAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.lead.count({ where }),
    ]);

    return { leads, total, limit: query.limit, offset: query.offset };
  });

  // GET /leads/export → .xlsx with all filters applied (no pagination)
  fastify.get('/leads/export', async (request, reply) => {
    const query = leadExportQuerySchema.parse(request.query);
    const where = buildLeadWhere(query);

    const leads = await prisma.lead.findMany({
      where,
      include: {
        stage: true,
        pipeline: true,
        notes: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Autoscar';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Leads');

    sheet.columns = [
      { header: 'Nome', key: 'name', width: 28 },
      { header: 'Telefone', key: 'phone', width: 18 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Cidade', key: 'city', width: 18 },
      { header: 'Pipeline', key: 'pipeline', width: 18 },
      { header: 'Etapa', key: 'stage', width: 18 },
      { header: 'Veículo (URL)', key: 'vehicleUrl', width: 50 },
      { header: 'Forma de Pagamento', key: 'paymentMethod', width: 20 },
      { header: 'Status de Crédito', key: 'creditStatus', width: 20 },
      { header: 'Atendimento Humano', key: 'humanOverride', width: 20 },
      { header: 'Follow-ups', key: 'followupAttempts', width: 12 },
      { header: 'Criado em', key: 'createdAt', width: 20 },
      { header: 'Atualizado em', key: 'updatedAt', width: 20 },
      { header: 'Última Nota', key: 'lastNote', width: 60 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDC2626' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).alignment = { vertical: 'middle' };

    for (const lead of leads) {
      sheet.addRow({
        name: lead.name ?? '',
        phone: lead.contactPhone?.trim() || (lead.phone.startsWith('web:') ? '' : lead.phone),
        email: lead.email ?? '',
        city: lead.city ?? '',
        pipeline: lead.pipeline?.name ?? '',
        stage: lead.stage?.name ?? '',
        vehicleUrl: lead.vehicleUrl ?? '',
        paymentMethod: lead.paymentMethod ?? '',
        creditStatus: lead.creditStatus ?? '',
        humanOverride: lead.humanOverride ? 'Sim' : 'Não',
        followupAttempts: lead.followupAttempts,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        lastNote: lead.notes[0]?.content ?? '',
      });
    }

    sheet.getColumn('createdAt').numFmt = 'dd/mm/yyyy hh:mm';
    sheet.getColumn('updatedAt').numFmt = 'dd/mm/yyyy hh:mm';
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `leads-${stamp}.xlsx`;

    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(Buffer.from(buffer));
  });

  // GET /leads/:id/detail
  fastify.get('/leads/:id/detail', async (request, reply) => {
    const { id } = request.params as { id: string };

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id },
      include: {
        stage: true,
        pipeline: true,
        notes: { orderBy: { createdAt: 'desc' } },
        conversation: {
          include: {
            messages: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    return lead;
  });

  // PATCH /leads/:id
  fastify.patch('/leads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = patchLeadSchema.parse(request.body);

    const updated = await updateLead(id, body);
    fastify.io.emit('lead:updated', updated);

    return updated;
  });

  // PATCH /leads/:id/move
  fastify.patch('/leads/:id/move', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = moveSchema.parse(request.body);

    const updated = await moveToStage(id, body.stageId);
    fastify.io.emit('lead:moved', { leadId: id, stageId: body.stageId });

    return updated;
  });

  // PATCH /leads/:id/handoff
  fastify.patch('/leads/:id/handoff', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = handoffSchema.parse(request.body);

    const updated = await prisma.lead.update({
      where: { id },
      data: { humanOverride: body.override },
      include: { stage: true },
    });
    fastify.io.emit('lead:handoff', { leadId: id, humanOverride: body.override });

    return updated;
  });

  // DELETE /leads/:id
  fastify.delete('/leads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Delete related records first (foreign key constraints)
    await prisma.message.deleteMany({ where: { conversation: { leadId: id } } });
    await prisma.conversation.deleteMany({ where: { leadId: id } });
    await prisma.leadNote.deleteMany({ where: { leadId: id } });
    await prisma.lead.delete({ where: { id } });

    fastify.io.emit('lead:deleted', { leadId: id });
    return { deleted: true };
  });

  // POST /leads/:id/notes
  fastify.post('/leads/:id/notes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = noteSchema.parse(request.body);

    const note = await addNote(id, body.content, 'human');
    fastify.io.emit('lead:note-added', note);

    return note;
  });
}
