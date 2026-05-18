import prisma from '../db/prisma.js';
import { evolutionClient } from '../whatsapp/evolution.client.js';
import { getActiveAgent } from '../agent/agent.prompts.js';
import { getFollowupQueue } from '../queue/queues.js';

const SHORT_LINK_BASE = 'https://autoscar.com.br/carros/';

/**
 * Build the short-form vehicle URL for the sellers group. Uses the trigger
 * code registered on the agent when possible, and falls back to the numeric
 * ID at the end of the autoscar URL.
 */
function buildShortVehicleUrl(
  vehicleUrl: string | null | undefined,
  triggerUrls: string[] | undefined,
  triggerCodes: string[] | undefined,
): string | null {
  const url = vehicleUrl?.trim();
  if (!url) return null;

  // 1. Match against configured trigger URLs to use the exact registered code
  if (triggerUrls && triggerCodes) {
    for (let i = 0; i < triggerUrls.length; i++) {
      const trigger = triggerUrls[i]?.trim();
      const code = triggerCodes[i]?.trim();
      if (trigger && code && trigger === url) {
        return `${SHORT_LINK_BASE}${code}`;
      }
    }
  }

  // 2. Fall back to the last numeric path segment (autoscar puts the vehicle
  // ID at the tail of the URL, after the brand/model/version).
  const segments = url.split(/[/?#]/).filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    if (/^\d{3,}$/.test(segments[i])) return `${SHORT_LINK_BASE}${segments[i]}`;
  }

  // 3. Last resort: original URL
  return url;
}

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
 * Normalize a configured destination into an Evolution-ready recipient:
 *  - anything containing '@' (group ...@g.us or contact JID) → used as-is
 *  - otherwise → stripped to digits and treated as a phone number; Evolution
 *    accepts a bare international number (e.g. 5531999999999)
 */
function normalizeDestination(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (v.includes('@')) return v;
  const digits = v.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
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
      // Only include "ai" notes — these are conversation/interest summaries.
      // Internal automation notes use type "system" and stay out of the group.
      notes: {
        where: { type: 'ai' },
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
  });
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const agent = await getActiveAgent().catch(() => null);
  const shortUrl = buildShortVehicleUrl(
    lead.vehicleUrl,
    agent?.triggerVehicleUrls,
    agent?.triggerVehicleCodes,
  );

  const lines: string[] = [statusLabel(lead.stage?.name)];
  lines.push('');
  lines.push(`👤 Nome: ${lead.name?.trim() || 'não informado'}`);
  const displayPhone =
    lead.contactPhone?.trim() ||
    (lead.phone.startsWith('web:') ? 'não informado' : lead.phone);
  lines.push(`📞 Telefone: ${displayPhone}`);
  lines.push(`📍 Cidade: ${lead.city?.trim() || 'não informada'}`);
  if (lead.email?.trim()) lines.push(`✉️ Email: ${lead.email}`);
  lines.push(`🚗 Veículo: ${shortUrl || 'não informado'}`);
  lines.push(`📌 Estágio: ${lead.stage?.name ?? 'sem estágio'}`);

  if (lead.notes.length > 0) {
    lines.push('');
    lines.push('📝 Interesse do lead:');
    for (const note of lead.notes) {
      const snippet = note.content.length > 160 ? note.content.slice(0, 157) + '...' : note.content;
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

  // Send to the group AND/OR the dedicated phone number — whatever is set.
  const destinations = Array.from(
    new Set(
      [
        normalizeDestination(agent?.sellersGroupJid || process.env.SELLERS_GROUP_JID),
        normalizeDestination(agent?.sellersPhone),
      ].filter((d): d is string => !!d),
    ),
  );
  if (destinations.length === 0) {
    return { sent: false, reason: 'no sellers destination configured' };
  }

  const summary = await buildLeadSummary(leadId, opts.reason);

  let anySent = false;
  const errors: string[] = [];
  for (const dest of destinations) {
    try {
      await evolutionClient.sendText(instance.name, dest, summary);
      anySent = true;
    } catch (err) {
      errors.push(`${dest}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!anySent) {
    console.log(JSON.stringify({
      level: 'error',
      msg: '[seller-notify] failed to send',
      leadId,
      errors,
    }));
    return { sent: false, reason: 'send failed' };
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { sellerNotifiedAt: new Date() },
  });

  // Disable any pending follow-up for this lead — the sellers have it now.
  try {
    const followupQueue = getFollowupQueue();
    await followupQueue.remove(`followup-${lead.phone}`).catch(() => {});
  } catch { /* queue unavailable */ }

  console.log(JSON.stringify({
    level: 'info',
    msg: '[seller-notify] sent + follow-up disabled',
    leadId,
    reason: opts.reason,
  }));

  return { sent: true };
}
