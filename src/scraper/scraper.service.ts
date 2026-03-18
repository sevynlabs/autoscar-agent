import { ZodError } from 'zod';
import type { Vehicle } from './vehicle.schema.js';
import { getCachedVehicle, cacheVehicle } from './scraper.cache.js';
import { scrapeVehicle } from './autoscar.scraper.js';

// --- Custom error classes ---

export class ScraperValidationError extends Error {
  public readonly fields: string[];

  constructor(zodError: ZodError) {
    const fieldDetails = zodError.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    super(`Vehicle data validation failed: ${fieldDetails.join('; ')}`);
    this.name = 'ScraperValidationError';
    this.fields = zodError.issues.map((issue) => issue.path.join('.'));
  }
}

export class ScraperNavigationError extends Error {
  public readonly url: string;

  constructor(url: string, cause: unknown) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(`Failed to navigate to ${url}: ${causeMessage}`);
    this.name = 'ScraperNavigationError';
    this.url = url;
  }
}

// --- URL validation ---

const VALID_ORIGINS = [
  'https://autoscar.com.br',
  'https://www.autoscar.com.br',
];

function isValidAutoscarUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const origin = `${parsed.protocol}//${parsed.hostname}`;
    return VALID_ORIGINS.some((valid) => origin === valid);
  } catch {
    return false;
  }
}

// --- Service orchestrator ---

export interface VehicleResult {
  data: Vehicle;
  cached: boolean;
}

export async function getVehicleData(url: string): Promise<VehicleResult> {
  if (!isValidAutoscarUrl(url)) {
    throw new Error('URL must be from autoscar.com.br');
  }

  // Step 1: Check cache
  const cached = await getCachedVehicle(url);
  if (cached) {
    return { data: cached, cached: true };
  }

  // Step 2: Scrape
  try {
    const data = await scrapeVehicle(url);

    // Step 3: Cache on success
    await cacheVehicle(url, data);

    return { data, cached: false };
  } catch (err) {
    if (err instanceof ZodError) {
      const fieldNames = err.issues.map((i) => i.path.join('.'));
      console.error(
        `[scraper-service] Validation failed for ${url}. Missing/invalid fields: ${fieldNames.join(', ')}`,
      );
      throw new ScraperValidationError(err);
    }

    // Playwright timeout / navigation errors
    console.error(`[scraper-service] Navigation/scrape error for ${url}:`, err);
    throw new ScraperNavigationError(url, err);
  }
}
