const API_BASE = 'https://dhqmwf73sb.execute-api.us-east-1.amazonaws.com/prd';
const PHOTO_BASE = 'https://autoscar-storage-prd.s3.amazonaws.com/';

export interface VehicleSearchResult {
  title: string;
  price: string;
  year: string;
  km: string;
  url: string;
  photo: string;
  city: string;
  state: string;
}

export async function searchVehicles(query: string, limit = 5): Promise<VehicleSearchResult[]> {
  console.log(`[scraper-search] API search: "${query}"`);

  try {
    const res = await fetch(`${API_BASE}/advertisement?search=${encodeURIComponent(query)}&limit=${limit}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) return [];

    const json = await res.json() as any;
    const items = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];

    return items.slice(0, limit).map((v: any) => {
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
