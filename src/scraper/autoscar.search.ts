import * as cheerio from 'cheerio';

export interface VehicleSearchResult {
  title: string;
  price: string;
  year: string;
  km: string;
  url: string;
  photo: string;
}

/**
 * Search vehicles on autoscar.com.br by keyword (model, brand, etc)
 * Uses the portal's search/listing pages
 */
export async function searchVehicles(query: string, limit = 5): Promise<VehicleSearchResult[]> {
  const searchUrl = `https://www.autoscar.com.br/comprar?q=${encodeURIComponent(query)}`;

  console.log(`[scraper-search] Searching: ${searchUrl}`);

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });

    if (!response.ok) {
      console.log(`[scraper-search] HTTP ${response.status} for ${searchUrl}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const results: VehicleSearchResult[] = [];

    // Try common listing card selectors
    const cardSelectors = [
      'a[href*="/comprar/"]',
      '.card-vehicle',
      '.vehicle-card',
      '[class*="card"]',
      '[class*="vehicle"]',
      '[class*="listing"]',
    ];

    for (const selector of cardSelectors) {
      $(selector).each((i, el) => {
        if (results.length >= limit) return false;

        const $el = $(el);
        const href = $el.attr('href') ?? $el.find('a').first().attr('href') ?? '';
        if (!href.includes('/comprar/') && !href.includes('autoscar')) return;

        const fullUrl = href.startsWith('http') ? href : `https://www.autoscar.com.br${href}`;

        const title = $el.find('h2, h3, [class*="title"], [class*="name"]').first().text().trim()
          || $el.find('p').first().text().trim()
          || $el.text().trim().substring(0, 60);

        if (!title || title.length < 3) return;

        // Avoid duplicates
        if (results.some(r => r.url === fullUrl)) return;

        const price = $el.find('[class*="price"], [class*="valor"]').first().text().trim()
          || extractPrice($el.text());

        const photo = $el.find('img').first().attr('src') ?? $el.find('img').first().attr('data-src') ?? '';

        const detailText = $el.text();
        const year = extractYear(detailText);
        const km = extractKm(detailText);

        results.push({
          title: title.substring(0, 80),
          price: price || 'Consulte',
          year: year || '',
          km: km || '',
          url: fullUrl,
          photo: photo.startsWith('http') ? photo : photo ? `https://www.autoscar.com.br${photo}` : '',
        });
      });

      if (results.length > 0) break;
    }

    console.log(`[scraper-search] Found ${results.length} results for "${query}"`);
    return results;
  } catch (err) {
    console.error(`[scraper-search] Error searching:`, err instanceof Error ? err.message : err);
    return [];
  }
}

function extractPrice(text: string): string {
  const match = text.match(/R\$\s*[\d.,]+/);
  return match ? match[0] : '';
}

function extractYear(text: string): string {
  const match = text.match(/20[1-2]\d[\/\-]?20?[1-2]?\d?/);
  return match ? match[0] : '';
}

function extractKm(text: string): string {
  const match = text.match(/[\d.,]+\s*km/i);
  return match ? match[0] : '';
}
