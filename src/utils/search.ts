import type { CSVRow, MarketPriceSource, PriceRange, Product, ImageCandidate } from '../types';
import { getAccessToken } from '@/lib/supabase/client';

/** fetch with timeout — AbortSignal.timeout is not available in all browsers. */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 15_000, signal: externalSignal, ...rest } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  return fetch(input, { ...rest, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
}


/** UPC/EAN barcodes are 8â€“14 digits. */
export function isBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(value.trim());
}

export interface ProductLookupInput {
  /** Display label â€” product name when available, otherwise SKU/UPC or free text. */
  query: string;
  /** Numeric barcode (UPC/EAN) â€” catalog lookup is tried first when present. */
  originalUpc?: string;
  /** Product SKU â€” text-search hint (like a title), not a barcode lookup. */
  originalSku?: string;
}

function resolveNameAndIdentifier(first: string, second: string): ProductLookupInput {
  const a = first.trim();
  const b = second.trim();
  const aIsBarcode = isBarcode(a);
  const bIsBarcode = isBarcode(b);

  if (bIsBarcode && !aIsBarcode) {
    return { query: a || b, originalUpc: b };
  }
  if (aIsBarcode && !bIsBarcode) {
    return { query: b || a, originalUpc: a };
  }
  if (aIsBarcode && bIsBarcode) {
    return { query: a, originalUpc: a, originalSku: b !== a ? b : undefined };
  }

  return { query: a || b, originalSku: b || undefined };
}

/**
 * Parse a single free-text line (manual entry, bulk paste, or CSV-less row).
 * Supports bare UPC, bare SKU, product name, or "name + identifier" (tab/comma-separated).
 */
export function parseManualLookupInput(text: string): ProductLookupInput {
  const trimmed = text.trim();
  if (!trimmed) return { query: '' };

  if (isBarcode(trimmed)) {
    return { query: trimmed, originalUpc: trimmed };
  }

  const tabParts = trimmed.split(/\t/).map(p => p.trim()).filter(Boolean);
  if (tabParts.length >= 2) {
    return resolveNameAndIdentifier(tabParts[0]!, tabParts[1]!);
  }

  const commaParts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const barcode = commaParts.find(isBarcode);
    if (barcode) {
      const name = commaParts.filter(p => !isBarcode(p)).join(', ');
      return { query: name || barcode, originalUpc: barcode };
    }
    return resolveNameAndIdentifier(commaParts[0]!, commaParts.slice(1).join(', '));
  }

  return { query: trimmed };
}

/** Alias â€” each bulk line uses the same parsing rules as manual entry. */
export function parseBulkLine(line: string): ProductLookupInput {
  return parseManualLookupInput(line);
}

function pickBarcode(...values: string[]): string | undefined {
  return values.map(v => v.trim()).find(v => v && isBarcode(v));
}

function pickSku(skuRaw: string, upc?: string): string | undefined {
  const sku = skuRaw.trim();
  if (!sku) return undefined;
  if (upc && sku === upc) return undefined;
  if (isBarcode(sku)) return undefined;
  return sku;
}

/** Resolve lookup fields from a parsed CSV/spreadsheet row. */
export function getLookupFromRow(row: CSVRow): ProductLookupInput {
  const upcCol = (row.upc || '').trim();
  const skuCol = (row.sku || '').trim();
  const name = (row.name || '').trim();

  const originalUpc = pickBarcode(upcCol, skuCol);
  const originalSku = pickSku(skuCol, originalUpc) ?? pickSku(upcCol, originalUpc);

  const query =
    name ||
    originalSku ||
    originalUpc ||
    skuCol ||
    upcCol ||
    '';

  return { query, originalUpc, originalSku };
}

/**
 * Normalize query + optional UPC/SKU into consistent lookup fields.
 * UPC and SKU are kept separate; both may be present on the same row.
 */
export function normalizeProductLookup(
  query: string,
  identifiers: { originalUpc?: string; originalSku?: string } = {},
): ProductLookupInput {
  const trimmedQuery = query.trim();
  const trimmedUpc = identifiers.originalUpc?.trim();
  const trimmedSku = identifiers.originalSku?.trim();

  const originalUpc =
    trimmedUpc && isBarcode(trimmedUpc)
      ? trimmedUpc
      : isBarcode(trimmedQuery)
        ? trimmedQuery
        : undefined;

  const originalSku =
    trimmedSku && trimmedSku !== originalUpc && !isBarcode(trimmedSku)
      ? trimmedSku
      : undefined;

  const displayQuery =
    trimmedQuery ||
    originalSku ||
    originalUpc ||
    '';

  return { query: displayQuery, originalUpc, originalSku };
}

export interface SearchParams {
  /** Product name â€” text search on eBay (paired with sku for disambiguation). */
  query: string;
  upc?: string;
  /** SKU â€” text search hint, same role as query; used to narrow ambiguous matches. */
  sku?: string;
}

/**
 * Build API search parameters.
 * UPC is resolved in the catalog first; query and sku are both text-search hints.
 */
export function resolveSearchParams(
  query: string,
  identifiers: { originalUpc?: string; originalSku?: string } = {},
): SearchParams {
  const { query: q, originalUpc, originalSku } = normalizeProductLookup(query, identifiers);

  const fallbackTitle =
    q && q !== originalUpc && q !== originalSku ? q : undefined;

  return {
    query: fallbackTitle ?? '',
    upc: originalUpc,
    sku: originalSku,
  };
}
// --- product API ---

export type BackendSearchResult =
  | { type: 'found';     source: string; product: Product; missingFields?: string[]; imageCandidates?: ImageCandidate[] }
  | { type: 'ambiguous'; source: string; results: Product[]; missingFields?: string[]; imageCandidates?: ImageCandidate[] }
  | { type: 'not_found'; query?: string; missingFields?: string[] }
  | { type: 'unavailable'; reason: string };

export async function searchProduct(
  query: string,
  upc?: string,
  sku?: string,
): Promise<BackendSearchResult> {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (upc)   params.set('upc', upc);
  if (sku)   params.set('sku', sku);

  try {
    const token = await getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetchWithTimeout(`/api/search?${params}`, {
      timeoutMs: 15_000,
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { type: 'unavailable', reason: err.error || `HTTP ${res.status}` };
    }

    return (await res.json()) as BackendSearchResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { type: 'unavailable', reason: msg };
  }
}

export function getProductMarketPrice(product: Product): number | null {
  return product.marketPrice ?? null;
}

export function formatPrice(price: number | null): string {
  if (price === null) return 'N/A';
  return `$${price.toFixed(2)}`;
}

export function getMarketPriceSourceLabel(
  source?: MarketPriceSource | string,
  variant: 'full' | 'short' = 'full',
): string {
  if (variant === 'short') {
    switch (source) {
      case 'amazon_retail':
        return 'Amazon';
      case 'ebay_completed':
        return 'eBay sold avg';
      case 'upc_offers':
        return 'UPC catalog';
      case 'upc_store':
        return 'UPC store';
      case 'upc_recorded':
        return 'UPC recorded';
      case 'tcgplayer_market':
        return 'TCGPlayer';
      case 'manual':
        return 'Manual';
      default:
        if (typeof source === 'string' && source.startsWith('upc_store:')) {
          return source.slice('upc_store:'.length) || 'UPC store';
        }
        return 'Online lookup';
    }
  }

  switch (source) {
    case 'amazon_retail':
      return 'Amazon retail price';
    case 'ebay_completed':
      return 'Based on eBay sold listings';
    case 'upc_offers':
      return 'Based on merchant offers (UPC database)';
    case 'upc_store':
      return 'Based on a UPC shopping-info store offer';
    case 'upc_recorded':
      return 'Based on recorded catalog price (UPC database)';
    case 'tcgplayer_market':
      return 'TCGPlayer market price';
    case 'manual':
      return 'Manual estimate';
    default:
      if (typeof source === 'string' && source.startsWith('upc_store:')) {
        return `UPC store offer (${source.slice('upc_store:'.length)})`;
      }
      return 'From online product lookup';
  }
}

export function formatPriceRange(range?: PriceRange): string | null {
  if (!range) return null;
  return `$${range.low.toFixed(2)} â€“ $${range.high.toFixed(2)}`;
}
