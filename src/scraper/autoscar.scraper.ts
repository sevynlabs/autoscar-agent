import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { vehicleSchema, type Vehicle } from './vehicle.schema.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

export async function scrapeVehicle(url: string): Promise<Vehicle> {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ userAgent: USER_AGENT });

    // Hide webdriver flag to avoid bot detection
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });

    // Wait for main content to render
    await page
      .waitForSelector('h1, [class*="title"], [class*="vehicle"]', {
        timeout: 15_000,
      })
      .catch(() => {
        // Non-fatal: continue with whatever HTML we have
        console.warn('[scraper] Selector wait timed out, proceeding with available HTML');
      });

    const html = await page.content();
    const $ = cheerio.load(html);

    const model = extractModel($);
    const year = extractYear($);
    const km = extractKm($);
    const price = extractPrice($);
    const photos = extractPhotos($);
    const color = extractOptionalField($, ['cor', 'color']);
    const fuel = extractOptionalField($, ['combustivel', 'combustível', 'fuel']);
    const transmission = extractOptionalField($, ['cambio', 'câmbio', 'transmission']);
    const plate = extractOptionalField($, ['placa', 'plate']);
    const city = extractOptionalField($, ['cidade', 'city', 'localização']);

    const rawData: Record<string, unknown> = {
      model,
      year,
      km,
      price,
      photos,
    };

    if (color) rawData['color'] = color;
    if (fuel) rawData['fuel'] = fuel;
    if (transmission) rawData['transmission'] = transmission;
    if (plate) rawData['plate'] = plate;
    if (city) rawData['city'] = city;

    // Validate with Zod — throws ZodError if required fields are missing
    const vehicle = vehicleSchema.parse(rawData);
    return vehicle;
  } finally {
    await browser.close();
  }
}

// --- Extraction helpers with fallback selectors ---

function extractModel($: cheerio.CheerioAPI): string {
  // Primary: h1 tag
  const h1 = $('h1').first().text().trim();
  if (h1) return h1;

  // Fallback: title-like class
  const titleEl = $('[class*="title"]').first().text().trim();
  if (titleEl) {
    console.warn('[scraper] model: fell back to [class*="title"] selector');
    return titleEl;
  }

  // Fallback: og:title meta
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  if (ogTitle) {
    console.warn('[scraper] model: fell back to og:title meta');
    return ogTitle;
  }

  return '';
}

function extractYear($: cheerio.CheerioAPI): string {
  // Look for year patterns in text content
  const yearPattern = /\b(19|20)\d{2}(\/\d{4})?\b/;

  // Try structured data fields first
  const candidates = $('[class*="year"], [class*="ano"], [data-year]');
  for (const el of candidates.toArray()) {
    const text = $(el).text().trim();
    const match = text.match(yearPattern);
    if (match) return match[0];
  }

  // Fallback: scan detail/spec items
  const detailItems = $('[class*="detail"], [class*="spec"], [class*="info"] li, [class*="feature"]');
  for (const el of detailItems.toArray()) {
    const text = $(el).text().trim();
    const match = text.match(yearPattern);
    if (match) {
      console.warn('[scraper] year: fell back to detail/spec scanning');
      return match[0];
    }
  }

  return '';
}

function extractKm($: cheerio.CheerioAPI): string {
  const kmPattern = /[\d.,]+\s*km/i;

  // Try structured km fields
  const candidates = $('[class*="km"], [class*="mileage"], [class*="quilometr"]');
  for (const el of candidates.toArray()) {
    const text = $(el).text().trim();
    const match = text.match(kmPattern);
    if (match) return match[0];
  }

  // Fallback: scan all text for km pattern
  const allText = $('body').text();
  const match = allText.match(kmPattern);
  if (match) {
    console.warn('[scraper] km: fell back to body text scanning');
    return match[0];
  }

  return '';
}

function extractPrice($: cheerio.CheerioAPI): string {
  const pricePattern = /R\$\s*[\d.,]+/;

  // Try structured price fields
  const candidates = $('[class*="price"], [class*="preco"], [class*="preço"], [class*="valor"]');
  for (const el of candidates.toArray()) {
    const text = $(el).text().trim();
    const match = text.match(pricePattern);
    if (match) return match[0];
  }

  // Fallback: scan body for R$ pattern
  const allText = $('body').text();
  const match = allText.match(pricePattern);
  if (match) {
    console.warn('[scraper] price: fell back to body text scanning');
    return match[0];
  }

  return '';
}

function extractPhotos($: cheerio.CheerioAPI): string[] {
  const photos: string[] = [];
  const seen = new Set<string>();

  // Primary: images from autoscar or gallery
  $('img[src*="autoscar"], [class*="gallery"] img, [class*="photo"] img, [class*="slider"] img').each(
    (_i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !seen.has(src) && isValidPhotoUrl(src)) {
        seen.add(src);
        photos.push(src);
      }
    },
  );

  if (photos.length > 0) return photos;

  // Fallback: og:image
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage && isValidPhotoUrl(ogImage)) {
    console.warn('[scraper] photos: fell back to og:image meta');
    photos.push(ogImage);
  }

  // Fallback: any large images on page
  if (photos.length === 0) {
    $('img').each((_i, el) => {
      const src = $(el).attr('src');
      if (src && !seen.has(src) && isValidPhotoUrl(src)) {
        seen.add(src);
        photos.push(src);
      }
    });
    if (photos.length > 0) {
      console.warn('[scraper] photos: fell back to generic img scan');
    }
  }

  return photos;
}

function extractOptionalField(
  $: cheerio.CheerioAPI,
  keywords: string[],
): string | undefined {
  // Search for detail items containing any of the keywords
  const detailItems = $(
    '[class*="detail"] li, [class*="spec"] li, [class*="info"] li, [class*="feature"], table tr, dl dt, dl dd',
  );

  for (const el of detailItems.toArray()) {
    const text = $(el).text().trim().toLowerCase();
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        // Try to extract the value part (after colon, or the sibling element)
        const fullText = $(el).text().trim();
        const colonIdx = fullText.indexOf(':');
        if (colonIdx >= 0) {
          const value = fullText.substring(colonIdx + 1).trim();
          if (value) return value;
        }
        // If it's a dt, try the next dd
        if (el.type === 'tag' && el.tagName === 'dt') {
          const dd = $(el).next('dd').text().trim();
          if (dd) return dd;
        }
        return fullText;
      }
    }
  }

  return undefined;
}

function isValidPhotoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
