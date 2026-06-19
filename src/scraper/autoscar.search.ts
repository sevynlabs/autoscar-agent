const API_BASE = 'https://dhqmwf73sb.execute-api.us-east-1.amazonaws.com/prd';
const PHOTO_BASE = 'https://autoscar-storage-prd.s3.amazonaws.com/';

export interface VehicleSearchResult {
  title: string;
  price: string;
  priceValue: number;
  year: string;
  km: string;
  url: string;
  photo: string;
  city: string;
  state: string;
}

export interface SearchOptions {
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}

export async function searchVehicles(queryOrOptions: string | SearchOptions, limit = 5): Promise<VehicleSearchResult[]> {
  // Handle both old signature (query string) and new signature (options object)
  const opts: SearchOptions = typeof queryOrOptions === 'string'
    ? { query: queryOrOptions, limit }
    : { ...queryOrOptions, limit: queryOrOptions.limit ?? limit };

  const queryParams = new URLSearchParams();
  if (opts.query) queryParams.set('search', opts.query);
  if (opts.minPrice) queryParams.set('minPrice', String(opts.minPrice));
  if (opts.maxPrice) queryParams.set('maxPrice', String(opts.maxPrice));
  queryParams.set('limit', String(opts.limit ?? 5));

  console.log(`[scraper-search] API search: ${queryParams.toString()}`);

  try {
    const res = await fetch(`${API_BASE}/advertisement?${queryParams.toString()}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) return [];

    const json = await res.json() as any;
    let items = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];

    // Client-side price filtering (in case API doesn't support it)
    if (opts.minPrice || opts.maxPrice) {
      items = items.filter((v: any) => {
        const price = Number(v.price) || 0;
        if (opts.minPrice && price < opts.minPrice) return false;
        if (opts.maxPrice && price > opts.maxPrice) return false;
        return true;
      });
    }

    return items.slice(0, opts.limit ?? 5).map((v: any) => {
      const model = v.model ?? {};
      const user = v.user ?? {};
      const photos = v.photoUrl ?? [];
      const firstPhoto = photos[0] ? `${PHOTO_BASE}${photos[0]}` : '';

      // Build full autoscar URL: /carros/{state}/{city}/id{userId}/{brand}/{model}/{version}/{adId}
      const state = (v.state ?? '').toLowerCase();
      const city = (v.city ?? '').toLowerCase().replace(/\s+/g, '-');
      const brand = (model.brandName ?? '').toLowerCase().replace(/\s+/g, '-');
      const modelName = (model.name ?? '').toLowerCase().replace(/\s+/g, '-');
      const version = (model.version ?? '').toLowerCase().replace(/[./]+/g, '.').replace(/\s+/g, '-');
      const userId = user.id ?? '';
      const url = `https://www.autoscar.com.br/carros/${state}/${city}/id${userId}/${brand}/${modelName}/${version}/${v.id}`;

      return {
        title: `${model.brandName ?? ''} ${model.name ?? ''} ${model.version ?? ''}`.trim(),
        price: v.price ? `R$ ${Number(v.price).toLocaleString('pt-BR')}` : 'Consulte',
        priceValue: Number(v.price) || 0,
        year: `${model.fabricationYear ?? ''}/${model.modelYear ?? ''}`,
        km: v.mileage ? `${Number(v.mileage).toLocaleString('pt-BR')} km` : '',
        url,
        photo: firstPhoto,
        city: v.city ?? '',
        state: v.state ?? '',
      };
    });
  } catch (err) {
    console.error('[scraper-search] Error:', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Search vehicles by price range.
 */
export async function searchByPrice(
  minPrice: number,
  maxPrice: number,
  limit = 5,
): Promise<VehicleSearchResult[]> {
  return searchVehicles({ minPrice, maxPrice, limit });
}
