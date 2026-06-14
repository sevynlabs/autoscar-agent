import type { Vehicle } from './vehicle.schema.js';
import { getCachedVehicle, cacheVehicle } from './scraper.cache.js';

const API_BASE = 'https://dhqmwf73sb.execute-api.us-east-1.amazonaws.com/prd';
const PHOTO_BASE = 'https://autoscar-storage-prd.s3.amazonaws.com/';

// Hard ceiling for the external autoscar API. Node's fetch (undici) has no
// default timeout, so without this a slow/unreachable API hangs the request
// indefinitely — and since /webchat/config (public, ad traffic) blocks on
// this, hung requests pile up on the backend and cascade into 504s.
const API_TIMEOUT_MS = 6000;

export interface VehicleResult {
  data: Vehicle;
  cached: boolean;
  fullUrl?: string;
}

/**
 * Extract advertisement ID from autoscar URL
 * Supports: /comprar/288509, /comprar/288509/toyota-hilux, etc.
 */
function extractAdId(url: string): string | null {
  // Match /comprar/123456 in URL
  const comprarMatch = url.match(/\/comprar\/(\d+)/);
  if (comprarMatch) return comprarMatch[1];
  // New autoscar URL format: /carros/mg/uberlandia/id5125/ford/ranger/.../242230
  // The ad ID is the LAST number in the path (before any query string)
  const pathOnly = url.split('?')[0];
  const pathParts = pathOnly.split('/');
  for (let i = pathParts.length - 1; i >= 0; i--) {
    const num = pathParts[i].match(/^(\d{4,})$/);
    if (num) return num[1];
  }
  // Fallback: just a plain number
  const numMatch = url.match(/^(\d+)$/);
  return numMatch ? numMatch[1] : null;
}

/**
 * Get vehicle data from autoscar.com.br API (fast, reliable, no Playwright)
 */
export async function getVehicleData(urlOrId: string): Promise<VehicleResult> {
  // Check cache first
  const cached = await getCachedVehicle(urlOrId);
  if (cached) {
    return { data: cached, cached: true };
  }

  const adId = extractAdId(urlOrId) ?? urlOrId;
  console.log(`[scraper-service] Fetching vehicle via API: ${adId}`);

  try {
    const res = await fetch(`${API_BASE}/advertisement/${adId}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`API returned ${res.status} for ad ${adId}`);
    }

    const v = await res.json() as any;
    const model = v.model ?? {};
    const user = v.user ?? {};
    const photos = (v.photoUrl ?? []).map((p: string) => `${PHOTO_BASE}${p}`);

    const vehicle: Vehicle = {
      model: `${model.brandName ?? ''} ${model.name ?? ''} ${model.version ?? ''}`.trim(),
      year: `${model.fabricationYear ?? ''}/${model.modelYear ?? ''}`,
      price: v.price ? `R$ ${Number(v.price).toLocaleString('pt-BR')}` : 'Consulte',
      km: v.mileage ? `${Number(v.mileage).toLocaleString('pt-BR')} km` : 'Nao informado',
      photos,
      color: v.color ?? undefined,
      fuel: v.fuelType ?? undefined,
      transmission: v.transmission ?? undefined,
      city: v.city ?? undefined,
      // Seller info
      sellerPhone: user.phone ?? undefined,
      sellerWhatsapp: user.whatsapp ?? undefined,
      sellerName: user.fantasyName ?? user.name ?? undefined,
      sellerCompany: user.companyName ?? undefined,
    };

    // Build full autoscar URL
    const state = (v.state ?? '').toLowerCase();
    const city = (v.city ?? '').toLowerCase().replace(/\s+/g, '-');
    const brand = (model.brandName ?? '').toLowerCase().replace(/\s+/g, '-');
    const modelName = (model.name ?? '').toLowerCase().replace(/\s+/g, '-');
    const version = (model.version ?? '').toLowerCase().replace(/[./]+/g, '.').replace(/\s+/g, '-');
    const userId = user.id ?? '';
    const fullUrl = `https://www.autoscar.com.br/carros/${state}/${city}/id${userId}/${brand}/${modelName}/${version}/${v.id}`;

    // Cache
    await cacheVehicle(urlOrId, vehicle);

    console.log(`[scraper-service] Vehicle: ${vehicle.model} | ${vehicle.price} | ${vehicle.km}`);
    return { data: vehicle, cached: false, fullUrl };
  } catch (err) {
    console.error(`[scraper-service] API error for ${adId}:`, err instanceof Error ? err.message : err);

    // Fallback: try search by ID
    try {
      const searchRes = await fetch(`${API_BASE}/advertisement?search=${adId}&limit=1`, {
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
      if (searchRes.ok) {
        const json = await searchRes.json() as any;
        const items = json.data ?? json;
        if (Array.isArray(items) && items.length > 0) {
          const v = items[0];
          const m = v.model ?? {};
          const photos = (v.photoUrl ?? []).map((p: string) => `${PHOTO_BASE}${p}`);
          const vehicle: Vehicle = {
            model: `${m.brandName ?? ''} ${m.name ?? ''} ${m.version ?? ''}`.trim(),
            year: `${m.fabricationYear ?? ''}/${m.modelYear ?? ''}`,
            price: v.price ? `R$ ${Number(v.price).toLocaleString('pt-BR')}` : 'Consulte',
            km: v.mileage ? `${Number(v.mileage).toLocaleString('pt-BR')} km` : '',
            photos,
          };
          await cacheVehicle(urlOrId, vehicle);
          return { data: vehicle, cached: false };
        }
      }
    } catch { /* fallback failed */ }

    throw new Error(`Vehicle not found: ${urlOrId}`);
  }
}
