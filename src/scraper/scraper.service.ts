import type { Vehicle } from './vehicle.schema.js';
import { getCachedVehicle, cacheVehicle } from './scraper.cache.js';

const API_BASE = 'https://dhqmwf73sb.execute-api.us-east-1.amazonaws.com/prd';
const PHOTO_BASE = 'https://autoscar-storage-prd.s3.amazonaws.com/';

export interface VehicleResult {
  data: Vehicle;
  cached: boolean;
}

/**
 * Extract advertisement ID from autoscar URL
 * Supports: /comprar/288509, /comprar/288509/toyota-hilux, etc.
 */
function extractAdId(url: string): string | null {
  const match = url.match(/\/comprar\/(\d+)/);
  if (match) return match[1];
  // Try just a number (agent might pass just the ID)
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
    });

    if (!res.ok) {
      throw new Error(`API returned ${res.status} for ad ${adId}`);
    }

    const v = await res.json() as any;
    const model = v.model ?? {};
    const photos = (v.photoUrl ?? []).map((p: string) => `${PHOTO_BASE}${p}`);

    const vehicle: Vehicle = {
      model: `${model.brandName ?? ''} ${model.name ?? ''} ${model.version ?? ''}`.trim(),
      year: `${model.fabricationYear ?? ''}/${model.modelYear ?? ''}`,
      price: v.price ? `R$ ${Number(v.price).toLocaleString('pt-BR')}` : 'Consulte',
      km: v.mileage ? `${Number(v.mileage).toLocaleString('pt-BR')} km` : '',
      photos,
    };

    // Cache
    await cacheVehicle(urlOrId, vehicle);

    console.log(`[scraper-service] Vehicle: ${vehicle.model} | ${vehicle.price} | ${photos.length} photos`);
    return { data: vehicle, cached: false };
  } catch (err) {
    console.error(`[scraper-service] API error for ${adId}:`, err instanceof Error ? err.message : err);

    // Fallback: try search by ID
    try {
      const searchRes = await fetch(`${API_BASE}/advertisement?search=${adId}&limit=1`);
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
