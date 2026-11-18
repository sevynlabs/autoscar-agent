/**
 * Backfill SellerNotificationLog for leads notified before the log existed.
 *
 * For every lead with sellerNotifiedAt and no log rows yet, resolves the
 * seller of its vehicleUrl via the READ-ONLY ad endpoint
 * (GET /advertisement/{id}, one call per unique ad) and inserts one "sent"
 * row dated at sellerNotifiedAt with channel = 'backfill', reason = 'backfill'.
 *
 * Never call POST /advertisementLeads here: that endpoint registers a lead
 * with the advertiser, so a lookup with a dummy lead could create fake
 * "Consulta" leads for every seller.
 *
 * Limitations (historical data was never stored):
 * - Only the LAST notification of each lead is known (sellerNotifiedAt), and
 *   it is set when ANY destination received the lead (incl. the default
 *   group) — so rows are an estimate, flagged as channel 'backfill'.
 * - The seller returned is the CURRENT seller of the ad; removed/sold ads
 *   resolve to nothing → row saved with destinationType 'unknown', which the
 *   reports exclude.
 * - Seller phone comes from the ad's user.phone (fallback user.whatsapp),
 *   which may differ from the customer.phone the live flow gets from
 *   /advertisementLeads. Group mapping is matched by email first.
 *
 * Usage (dry run by default — prints the report, writes nothing; only
 * read-only GETs are made to the Autoscar API):
 *   npx tsx scripts/backfill-seller-notifications.ts [--from 2026-08-01] [--to 2026-11-10]
 *   npx tsx scripts/backfill-seller-notifications.ts --apply
 */
import prisma from '../src/db/prisma.js';
import { isVehicleUrl } from '../src/agent/agent.prompts.js';
import { normalizeDestination } from '../src/crm/seller-notification.service.js';
import { extractAdId } from '../src/scraper/scraper.service.js';

const AD_API_URL = 'https://dhqmwf73sb.execute-api.us-east-1.amazonaws.com/prd/advertisement';
const CONCURRENCY = 3;

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const argValue = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const from = argValue('--from');
const to = argValue('--to');

interface ResolvedSeller {
  sellerName: string | null;
  sellerPhone: string | null;
  sellerEmail: string | null;
  groupJid: string | null;
  groupName: string | null;
}

async function resolveSeller(url: string): Promise<ResolvedSeller | null> {
  const adId = extractAdId(url);
  if (!adId) return null;
  try {
    // Read-only lookup — see header: never POST /advertisementLeads here.
    const res = await fetch(`${AD_API_URL}/${adId}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null; // 404 = ad removed/sold
    const data = await res.json() as {
      user?: { name?: string; fantasyName?: string; phone?: string; whatsapp?: string; email?: string };
    };
    const c = data.user;
    if (!c || (!c.phone && !c.whatsapp && !c.email)) return null;

    const sellerPhone = normalizeDestination(c.phone || c.whatsapp);
    const sellerEmail = c.email?.trim().toLowerCase() || null;

    // Same priority as notifySellersGroupForLead: email first, then phone
    let mapping = sellerEmail
      ? await prisma.sellerGroupMapping.findUnique({ where: { sellerEmail } })
      : null;
    if (!mapping && sellerPhone) {
      mapping = await prisma.sellerGroupMapping.findFirst({ where: { sellerPhone } });
    }

    return {
      sellerName: c.fantasyName || c.name || null,
      sellerPhone,
      sellerEmail,
      groupJid: mapping?.groupJid ?? null,
      groupName: mapping?.groupName ?? null,
    };
  } catch {
    return null;
  }
}

// Interpret --from/--to as America/Sao_Paulo calendar days (UTC-3, no DST)
const spDate = (d: string, endOfDay = false) =>
  new Date(`${d}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}-03:00`);

async function main() {
  const leads = await prisma.lead.findMany({
    where: {
      sellerNotifiedAt: {
        not: null,
        ...(from ? { gte: spDate(from) } : {}),
        ...(to ? { lte: spDate(to, true) } : {}),
      },
      sellerNotifications: { none: {} },
    },
    select: { id: true, name: true, phone: true, contactPhone: true, vehicleUrl: true, sellerNotifiedAt: true },
    orderBy: { sellerNotifiedAt: 'asc' },
  });

  const urls = Array.from(new Set(
    leads.map((l) => l.vehicleUrl?.trim()).filter((u): u is string => !!u && isVehicleUrl(u)),
  ));
  console.log(`Leads to backfill: ${leads.length} | unique vehicle URLs: ${urls.length}`);

  const sellers = new Map<string, ResolvedSeller | null>();
  let done = 0;
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(resolveSeller));
    batch.forEach((u, j) => sellers.set(u, results[j]));
    done += batch.length;
    if (done % 30 < CONCURRENCY || done === urls.length) {
      console.log(`  resolved ${done}/${urls.length}`);
    }
  }

  const rows = leads.map((l) => {
    const s = (l.vehicleUrl && sellers.get(l.vehicleUrl.trim())) || null;
    const destination = s?.groupJid || s?.sellerPhone || 'unknown';
    return {
      leadId: l.id,
      leadName: l.name,
      leadPhone: l.contactPhone?.trim() || l.phone,
      vehicleUrl: l.vehicleUrl,
      sellerName: s?.sellerName ?? null,
      sellerPhone: s?.sellerPhone ?? null,
      sellerEmail: s?.sellerEmail ?? null,
      groupJid: s?.groupJid ?? null,
      groupName: s?.groupName ?? null,
      destination,
      destinationType: s?.groupJid ? 'seller_group' : s?.sellerPhone ? 'seller_phone' : 'unknown',
      channel: 'backfill',
      status: 'sent',
      reason: 'backfill',
      createdAt: l.sellerNotifiedAt!,
    };
  });

  // Summary per month + seller
  const summary = new Map<string, number>();
  for (const r of rows) {
    const month = new Date(r.createdAt.getTime() - 3 * 3600_000).toISOString().slice(0, 7);
    const key = `${month} | ${r.sellerName ?? '(vendedor desconhecido)'}`;
    summary.set(key, (summary.get(key) ?? 0) + 1);
  }
  console.log('\nMonth   | Seller → leads');
  for (const [k, v] of [...summary.entries()].sort()) console.log(`${k} → ${v}`);
  console.log(`\nUnresolved (no seller found): ${rows.filter((r) => !r.sellerName).length}`);

  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to insert.');
    return;
  }
  const { count } = await prisma.sellerNotificationLog.createMany({ data: rows });
  console.log(`\nInserted ${count} backfill rows.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
