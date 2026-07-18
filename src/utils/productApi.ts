import type { Product, MarketPriceSource, PriceRange, ImageCandidate } from '../types';
import { getAccessToken } from '@/lib/supabase/client';
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
  return `$${range.low.toFixed(2)} – $${range.high.toFixed(2)}`;
}
