import prisma from '../db/prisma.js';
import { evolutionClient } from '../whatsapp/evolution.client.js';
import { getActiveAgent, isVehicleUrl } from '../agent/agent.prompts.js';
import { getFollowupQueue, getSellerNotificationQueue } from '../queue/queues.js';
import { CloudApiAdapter } from '../whatsapp/adapters/cloud-api.adapter.js';
import { SELLER_NOTIFICATION_DELAY_MS, type SellerNotificationJobData } from '../queue/jobs/seller-notification.job.js';

const LEADS_API_URL = 'https://dhqmwf73sb.execute-api.us-east-1.amazonaws.com/prd/advertisementLeads';
const LEADS_API_TIMEOUT_MS = 10000;

interface LeadsApiResponse {
  customer: {
    name: string;
    phone: string;
    email: string;
    fantasyName: string;
    companyName: string;
  };
  lead: {
    id: number;
    advertisementId: number;
  };
}

/**
 * Send lead data to the autoscar leads API and get seller info back.
 */
async function sendLeadToApi(leadPhone: string, leadName: string, vehicleUrl: string): Promise<LeadsApiResponse | null> {
  try {
    // Remove emojis and special unicode characters that may cause API issues
    const sanitizedName = leadName.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '').trim();

    const res = await fetch(LEADS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadPhone: leadPhone.replace(/\D/g, ''),
        leadName: sanitizedName || leadName,
        link: vehicleUrl,
      }),
      signal: AbortSignal.timeout(LEADS_API_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.log(JSON.stringify({
        level: 'warn',
        msg: '[seller-notify] leads API returned error',
        status: res.status,
      }));
      return null;
    }

    const data = await res.json() as LeadsApiResponse;
    console.log(JSON.stringify({
      level: 'info',
      msg: '[seller-notify] leads API success',
      sellerPhone: data.customer?.phone,
      sellerName: data.customer?.fantasyName,
    }));
    return data;
  } catch (err) {
    console.log(JSON.stringify({
      level: 'error',
      msg: '[seller-notify] leads API failed',
      error: err instanceof Error ? err.message : String(err),
    }));
    return null;
  }
}

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

/**
 * Send seller notification via Cloud API using approved template.
 * Template: novo_lead_veiculo
 * Variables: {{1}}=cliente, {{2}}=telefone, {{3}}=veiculo, {{4}}=link
 */
async function sendCloudApiSellerNotification(
  phoneNumber: string,
  leadName: string,
  leadPhone: string,
  vehicleDescription: string,
  vehicleUrl: string,
): Promise<boolean> {
  const cloudInstance = await prisma.whatsAppInstance.findFirst({
    where: { provider: 'cloud_api', status: 'connected' },
  });

  if (!cloudInstance?.accessToken || !cloudInstance?.phoneNumberId) {
    console.log(JSON.stringify({
      level: 'warn',
      msg: '[seller-notify] Cloud API instance not found or missing credentials',
    }));
    return false;
  }

  console.log(JSON.stringify({
    level: 'info',
    msg: '[seller-notify] Sending Cloud API template',
    to: phoneNumber,
    leadName,
    leadPhone,
    vehicleDescription,
    vehicleUrl,
  }));

  try {
    const adapter = new CloudApiAdapter({
      accessToken: cloudInstance.accessToken,
      phoneNumberId: cloudInstance.phoneNumberId,
    });

    await adapter.sendTemplate(phoneNumber, 'novo_lead_veiculo', 'pt_BR', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: leadName },
          { type: 'text', text: leadPhone },
          { type: 'text', text: vehicleDescription },
          { type: 'text', text: vehicleUrl },
        ],
      },
    ]);

    console.log(JSON.stringify({
      level: 'info',
      msg: '[seller-notify] Cloud API template sent',
      to: phoneNumber,
      template: 'novo_lead_veiculo',
    }));

    return true;
  } catch (err) {
    console.log(JSON.stringify({
      level: 'error',
      msg: '[seller-notify] Cloud API template failed',
      to: phoneNumber,
      error: err instanceof Error ? err.message : String(err),
    }));
    return false;
  }
}

/**
 * Normalize a configured destination into an Evolution-ready recipient:
 *  - anything containing '@' (group ...@g.us or contact JID) → used as-is
 *  - otherwise → stripped to digits and treated as a phone number; Evolution
 *    accepts a bare international number (e.g. 5531999999999)
 *  - Brazilian numbers starting with 0 (e.g. 034999714473) get 55 prefix
 */
function normalizeDestination(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (v.includes('@')) return v;
  let digits = v.replace(/\D/g, '');
  if (digits.length < 8) return null;
  // Brazilian number starting with 0 (e.g. 034999714473) → add 55 and remove leading 0
  if (digits.startsWith('0') && digits.length >= 10 && digits.length <= 12) {
    digits = '55' + digits.slice(1);
  }
  // Brazilian number without country code (10-11 digits) → add 55
  if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('55')) {
    digits = '55' + digits;
  }
  return digits;
}

/**
 * Build a complete summary of a lead for the sellers group notification.
 * Includes all known fields, vehicle link, and a direct link to the CRM
 * conversation so the seller can jump straight in.
 */
export async function buildLeadSummary(
  leadId: string,
  sellerName?: string | null,
): Promise<string> {
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

  const lines: string[] = [];

  // Header
  lines.push('📣 *LEAD DO PORTAL AUTOSCAR*');
  if (sellerName) {
    lines.push(`🏪 Loja: ${sellerName}`);
  }
  lines.push('');
  lines.push('🟢 LEAD QUALIFICADO');
  lines.push('');

  // Lead info
  lines.push(`👤 Nome: ${lead.name?.trim() || 'não informado'}`);
  const displayPhone =
    lead.contactPhone?.trim() ||
    (lead.phone.startsWith('web:') ? 'não informado' : lead.phone);
  lines.push(`📞 Telefone: ${displayPhone}`);
  lines.push(`📍 Cidade: ${lead.city?.trim() || 'não informada'}`);
  lines.push(`🚗 Veículo: ${shortUrl || 'não informado'}`);

  // Interest notes
  if (lead.notes.length > 0) {
    lines.push('');
    lines.push('📝 Interesse do lead:');
    for (const note of lead.notes) {
      const snippet = note.content.length > 160 ? note.content.slice(0, 157) + '...' : note.content;
      lines.push(`• ${snippet}`);
    }
  }

  // CRM link
  if (lead.conversation) {
    lines.push('');
    lines.push(`💬 Conversa: ${publicCrmUrl()}/inbox?conversation=${lead.conversation.id}`);
  }

  return lines.join('\n');
}

/**
 * Schedule a seller notification with a 3-minute delay.
 * This allows the conversation to complete before notifying the seller.
 * If the vehicle URL changes before the delay, the notification is skipped
 * and a new one will be scheduled for the new vehicle.
 */
export async function scheduleSellerNotification(
  leadId: string,
  opts: { reason?: string } = {},
): Promise<{ scheduled: boolean; reason?: string }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, vehicleUrl: true, sellerNotifiedAt: true, name: true, phone: true, contactPhone: true },
  });

  if (!lead) {
    return { scheduled: false, reason: 'lead not found' };
  }

  // Check if already notified for this vehicle
  if (lead.sellerNotifiedAt) {
    console.log(JSON.stringify({
      level: 'info',
      msg: '[seller-notify] Already notified, skipping schedule',
      leadId,
      sellerNotifiedAt: lead.sellerNotifiedAt,
    }));
    return { scheduled: false, reason: 'already notified' };
  }

  // Check if lead has required data
  const hasUsablePhone = !!(
    lead.contactPhone?.trim() ||
    (lead.phone && !lead.phone.startsWith('web:'))
  );
  if (!lead.name?.trim() || !hasUsablePhone) {
    console.log(JSON.stringify({
      level: 'info',
      msg: '[seller-notify] Missing name or phone, skipping schedule',
      leadId,
      hasName: !!lead.name?.trim(),
      hasPhone: hasUsablePhone,
    }));
    return { scheduled: false, reason: 'missing name or phone' };
  }

  const queue = getSellerNotificationQueue();
  const jobId = `seller-notify-${leadId}`;

  // Remove any existing job for this lead (in case vehicle changed)
  try {
    const existingJob = await queue.getJob(jobId);
    if (existingJob) {
      await existingJob.remove();
      console.log(JSON.stringify({
        level: 'info',
        msg: '[seller-notify] Removed existing scheduled job',
        leadId,
        jobId,
      }));
    }
  } catch {
    // Job doesn't exist, that's fine
  }

  // Schedule new notification
  const jobData: SellerNotificationJobData = {
    leadId,
    vehicleUrl: lead.vehicleUrl,
    reason: opts.reason,
  };

  await queue.add(jobId, jobData, {
    jobId,
    delay: SELLER_NOTIFICATION_DELAY_MS,
    removeOnComplete: true,
    removeOnFail: false,
  });

  console.log(JSON.stringify({
    level: 'info',
    msg: '[seller-notify] Scheduled notification with delay',
    leadId,
    vehicleUrl: lead.vehicleUrl,
    delayMs: SELLER_NOTIFICATION_DELAY_MS,
    jobId,
  }));

  return { scheduled: true };
}

/**
 * Fire a sellers group notification for a lead and mark sellerNotifiedAt.
 * Now allows multiple notifications — each time the vehicle changes, a new
 * notification is sent to the appropriate seller. The blocking was removed
 * to support leads interested in multiple vehicles from different sellers.
 */
export async function notifySellersGroupForLead(
  leadId: string,
  opts: { reason?: string; force?: boolean } = {},
): Promise<{ sent: boolean; reason?: string }> {
  console.log(JSON.stringify({
    level: 'info',
    msg: '[seller-notify] START - notifySellersGroupForLead called',
    leadId,
    opts,
  }));

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { sent: false, reason: 'lead not found' };

  // HARD GATE — single chokepoint for every path (agent tool, post-turn,
  // reengagement, manual endpoint). NEVER notify the seller without BOTH a
  // name AND a usable phone. `force` does NOT bypass this.
  const hasUsablePhone = !!(
    lead.contactPhone?.trim() ||
    (lead.phone && !lead.phone.startsWith('web:'))
  );
  if (!lead.name?.trim() || !hasUsablePhone) {
    console.log(JSON.stringify({
      level: 'info',
      msg: '[seller-notify] blocked — missing name or phone',
      leadId,
      hasName: Boolean(lead.name?.trim()),
      hasPhone: hasUsablePhone,
    }));
    return { sent: false, reason: 'missing name or phone' };
  }

  // NOTE: Blocking removed. Each vehicle interest generates a notification
  // to the seller of that vehicle. The same lead can be sent to multiple
  // sellers if they're interested in vehicles from different stores.
  // The lastNotifiedVehicleUrl field tracks which URL was last notified.

  const instance = await prisma.whatsAppInstance.findFirst({
    where: { status: 'connected' },
    orderBy: { createdAt: 'asc' },
  });
  if (!instance) return { sent: false, reason: 'no connected whatsapp instance' };

  const agent = await getActiveAgent().catch(() => null);

  // Send lead to API and get seller info
  let vehicleSellerPhone: string | null = null;
  let vehicleSellerName: string | null = null;
  const leadPhone = lead.contactPhone?.trim() || lead.phone;

  // Validate vehicle URL before sending to API
  const hasValidVehicleUrl = isVehicleUrl(lead.vehicleUrl);
  if (lead.vehicleUrl?.trim() && !hasValidVehicleUrl) {
    console.log(JSON.stringify({
      level: 'warn',
      msg: '[seller-notify] vehicle URL may be invalid (not a vehicle-specific URL)',
      leadId,
      vehicleUrl: lead.vehicleUrl,
      hint: 'Expected URL format: autoscar.com.br/carros/... or autoscar.com.br/comprar/...',
    }));
  }

  if (hasValidVehicleUrl && lead.name?.trim() && leadPhone) {
    const apiResult = await sendLeadToApi(leadPhone, lead.name, lead.vehicleUrl!);
    if (apiResult?.customer?.phone) {
      vehicleSellerPhone = normalizeDestination(apiResult.customer.phone);
      vehicleSellerName = apiResult.customer.fantasyName || apiResult.customer.name || null;
      console.log(JSON.stringify({
        level: 'info',
        msg: '[seller-notify] seller found for vehicle',
        leadId,
        vehicleUrl: lead.vehicleUrl,
        sellerPhone: vehicleSellerPhone,
        sellerName: vehicleSellerName,
      }));
    } else {
      console.log(JSON.stringify({
        level: 'warn',
        msg: '[seller-notify] no seller found for vehicle URL',
        leadId,
        vehicleUrl: lead.vehicleUrl,
      }));
    }
  }

  // Build destinations: ALWAYS include group + vehicle seller if found
  const groupJid = normalizeDestination(agent?.sellersGroupJid || process.env.SELLERS_GROUP_JID);
  const sellersPhone = normalizeDestination(agent?.sellersPhone);

  console.log(JSON.stringify({
    level: 'info',
    msg: '[seller-notify] Building destinations',
    leadId,
    vehicleSellerPhone,
    groupJid,
    sellersPhone,
    agentSellersGroupJid: agent?.sellersGroupJid,
    agentSellersPhone: agent?.sellersPhone,
    envSellersGroupJid: process.env.SELLERS_GROUP_JID,
  }));

  const destinations = Array.from(
    new Set(
      [
        vehicleSellerPhone,  // Vendedor da listagem (se houver)
        groupJid,            // Grupo sempre recebe
        sellersPhone,        // Telefone configurado no agente
      ].filter((d): d is string => !!d),
    ),
  );

  console.log(JSON.stringify({
    level: 'info',
    msg: '[seller-notify] Destinations resolved',
    leadId,
    destinations,
    count: destinations.length,
  }));

  if (destinations.length === 0) {
    console.log(JSON.stringify({
      level: 'warn',
      msg: '[seller-notify] NO DESTINATIONS - check agent config and env vars',
      leadId,
    }));
    return { sent: false, reason: 'no sellers destination configured' };
  }

  const summary = await buildLeadSummary(leadId, vehicleSellerName);

  let anySent = false;
  const errors: string[] = [];

  // Prepare lead data for Cloud API template
  const leadDisplayPhone = lead.contactPhone?.trim() || lead.phone;
  const shortUrl = buildShortVehicleUrl(
    lead.vehicleUrl,
    agent?.triggerVehicleUrls,
    agent?.triggerVehicleCodes,
  );
  const vehicleDescription = shortUrl || lead.vehicleUrl || 'Veiculo no portal';

  for (const dest of destinations) {
    console.log(JSON.stringify({
      level: 'info',
      msg: '[seller-notify] Attempting to send to destination',
      leadId,
      dest,
      isGroup: dest.includes('@'),
    }));

    try {
      // Try Cloud API template for phone numbers (not groups)
      if (!dest.includes('@') && lead.name && leadDisplayPhone) {
        console.log(JSON.stringify({
          level: 'info',
          msg: '[seller-notify] Trying Cloud API for phone destination',
          leadId,
          dest,
        }));
        const cloudSent = await sendCloudApiSellerNotification(
          dest,
          lead.name,
          leadDisplayPhone,
          vehicleDescription,
          shortUrl || lead.vehicleUrl || 'https://autoscar.com.br',
        );
        console.log(JSON.stringify({
          level: 'info',
          msg: '[seller-notify] Cloud API result',
          leadId,
          dest,
          cloudSent,
        }));
        if (cloudSent) {
          anySent = true;
          continue;
        }
      }

      // Fallback to Evolution API (for groups or if Cloud API unavailable)
      console.log(JSON.stringify({
        level: 'info',
        msg: '[seller-notify] Using Evolution API fallback',
        leadId,
        dest,
        instanceName: instance.name,
      }));
      await evolutionClient.sendText(instance.name, dest, summary);
      console.log(JSON.stringify({
        level: 'info',
        msg: '[seller-notify] Evolution API success',
        leadId,
        dest,
      }));
      anySent = true;
    } catch (err) {
      console.log(JSON.stringify({
        level: 'error',
        msg: '[seller-notify] Failed to send to destination',
        leadId,
        dest,
        error: err instanceof Error ? err.message : String(err),
      }));
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
