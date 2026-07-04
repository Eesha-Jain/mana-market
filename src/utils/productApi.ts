import type { Product, MarketPriceSource, PriceRange, ImageCandidate } from '../types';
import { getAccessToken } from '../lib/supabase';
import { fetchWithTimeout } from './fetchWithTimeout';

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

export function getProductImageUrl(
  product: Product,
  index = 0,
): string | null {
  return product.imageUrls[index] ?? null;
}

export function formatPrice(price: number | null): string {
  if (price === null) return 'N/A';
  return `$${price.toFixed(2)}`;
}

export function getMarketPriceSourceLabel(
  source?: MarketPriceSource,
  variant: 'full' | 'short' = 'full',
): string {
  if (variant === 'short') {
    switch (source) {
      case 'ebay_completed':
        return 'eBay sold avg';
      case 'upc_offers':
        return 'Merchant offers';
      case 'upc_recorded':
        return 'Recorded price';
      case 'manual':
        return 'Manual';
      default:
        return 'Online lookup';
    }
  }

  switch (source) {
    case 'ebay_completed':
      return 'Based on eBay sold listings';
    case 'upc_offers':
      return 'Based on merchant offers (UPC database)';
    case 'upc_recorded':
      return 'Based on recorded catalog price (UPC database)';
    case 'manual':
      return 'Manual estimate';
    default:
      return 'From online product lookup';
  }
}

export function formatPriceRange(range?: PriceRange): string | null {
  if (!range) return null;
  return `$${range.low.toFixed(2)} – $${range.high.toFixed(2)}`;
}
