// Query params we strip from a vehicle URL before it becomes the lead's
// vehicleUrl. `camp` carries our campaign code; the rest are ad/tracking noise.
const TRACKING_PARAMS = [
  'camp',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
];

const CODE_RE = /[A-Za-z0-9_-]{1,64}/;

/** Normalize a raw code string: trim, keep the first safe token, cap at 64. */
export function sanitizeCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.trim().match(CODE_RE);
  if (!match) return null;
  return match[0].slice(0, 64);
}

/**
 * Extract the campaign code from an ad's pre-filled WhatsApp message and
 * return a vehicle URL with the campaign/tracking params stripped.
 *
 * Priority: the `camp` query param on the vehicle URL. Fallback: a
 * `camp: CODE` / `camp=CODE` token in the free-text message. Pure — no DB,
 * no network.
 */
export function extractCampaign(
  vehicleUrl: string | null | undefined,
  message: string,
): { cleanUrl: string | null; campaignCode: string | null } {
  let cleanUrl: string | null = vehicleUrl ?? null;
  let campaignCode: string | null = null;

  if (vehicleUrl) {
    try {
      const url = new URL(vehicleUrl);
      campaignCode = sanitizeCode(url.searchParams.get('camp'));
      for (const param of TRACKING_PARAMS) url.searchParams.delete(param);
      cleanUrl = url.toString();
    } catch {
      // Not a parseable URL — leave it untouched.
      cleanUrl = vehicleUrl;
    }
  }

  if (!campaignCode) {
    const match = message.match(/camp[\s:=]+([A-Za-z0-9_-]{1,64})/i);
    if (match) campaignCode = sanitizeCode(match[1]);
  }

  return { cleanUrl, campaignCode };
}
