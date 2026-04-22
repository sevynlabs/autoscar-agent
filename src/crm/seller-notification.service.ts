import prisma from '../db/prisma.js';
import { evolutionClient } from '../whatsapp/evolution.client.js';
import { getActiveAgent } from '../agent/agent.prompts.js';

function publicCrmUrl(): string {
  return (
    process.env.PUBLIC_URL ||
    process.env.FRONTEND_PUBLIC_URL ||
    'https://autoscar.crmupx.com'
  ).replace(/\/+$/, '');
}

function statusLabel(_stageName: string | undefined): string {
  // Every notification sent to the sellers group is ALWAYS announced as a
  // qualified lead — business rule: leads are never disqualified.
  return '🟢 LEAD QUALIFICADO';
}

/**
 * Build a complete summary of a lead for the sellers group notification.
 * Includes all known fields, vehicle link, and a direct link to the CRM
 * conversation so the seller can jump straight in.
 */
export async function buildLeadSummary(leadId: string, reason?: string): Promise<string> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      stage: true,
      conversation: true,
      notes: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
  });
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const lines: string[] = [statusLabel(lead.stage?.name)];
  if (reason) lines.push(`Motivo: ${reason}`);
  lines.push('');
  lines.push(`👤 Nome: ${lead.name?.trim() || 'não informado'}`);
  lines.push(`📞 Telefone: ${lead.phone}`);
  lines.push(`📍 Cidade: ${lead.city?.trim() || 'não informada'}`);
  if (lead.email?.trim()) lines.push(`✉️ Email: ${lead.email}`);
  lines.push(`🚗 Veículo: ${lead.vehicleUrl?.trim() || 'não informado'}`);
  lines.push(`📌 Estágio: ${lead.stage?.name ?? 'sem estágio'}`);

  if (lead.notes.length > 0) {
    lines.push('');
    lines.push('📝 Últimas notas:');
    for (const note of lead.notes) {
      const snippet = note.content.length > 120 ? note.content.slice(0, 117) + '...' : note.content;
      lines.push(`• ${snippet}`);
    }
  }

  if (lead.conversation) {
    lines.push('');
    lines.push(`💬 Conversa: ${publicCrmUrl()}/inbox?conversation=${lead.conversation.id}`);
  }

  lines.push('');
  lines.push('Status: Aguardando contato do vendedor');

  return lines.join('\n');
}

/**
 * Fire a sellers group notification for a lead and mark sellerNotifiedAt.
 * Safe to call multiple times — only sends once per lead (unless force=true).
 */
export async function notifySellersGroupForLead(
  leadId: string,
  opts: { reason?: string; force?: boolean } = {},
): Promise<{ sent: boolean; reason?: string }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { sent: false, reason: 'lead not found' };

  if (!opts.force && lead.sellerNotifiedAt) {
    return { sent: false, reason: 'already notified' };
  }

  const instance = await prisma.whatsAppInstance.findFirst({
    where: { status: 'connected' },
    orderBy: { createdAt: 'asc' },
  });
  if (!instance) return { sent: false, reason: 'no connected whatsapp instance' };

  const agent = await getActiveAgent().catch(() => null);
  const sellersJid = agent?.sellersGroupJid || process.env.SELLERS_GROUP_JID;
  if (!sellersJid) return { sent: false, reason: 'no sellers group configured' };

  const summary = await buildLeadSummary(leadId, opts.reason);

  try {
    await evolutionClient.sendText(instance.name, sellersJid, summary);
  } catch (err) {
    console.log(JSON.stringify({
      level: 'error',
      msg: '[seller-notify] failed to send',
      leadId,
      error: err instanceof Error ? err.message : String(err),
    }));
    return { sent: false, reason: 'send failed' };
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { sellerNotifiedAt: new Date() },
  });

  console.log(JSON.stringify({
    level: 'info',
    msg: '[seller-notify] sent',
    leadId,
    reason: opts.reason,
  }));

  return { sent: true };
}
