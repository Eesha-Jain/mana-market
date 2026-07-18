import 'server-only';

import { serverEnv } from '@/lib/env/server';

export interface AmazonProductData {
  asin: string | null;
  title: string;
  description: string;
  imageUrls: string[];
  retailPrice: number | null;
  brand?: string;
  searchUrl?: string;
}

interface RainforestProduct {
  asin?: string;
  title?: string;
  description?: string;
  image?: string;
  main_image?: { link?: string };
  images?: Array<{ link?: string; variant?: string }>;
  images_flat?: string;
  buybox_winner?: {
    price?: { value?: number };
    /** Prefer when present — matches the one-time Buy Box price on the product page. */
    one_time_price?: number | { value?: number };
  };
  price?: { value?: number };
  brand?: string;
  link?: string;
}

interface RainforestResponse {
  product?: RainforestProduct;
  search_results?: RainforestProduct[];
}

async function fetchRainforest(query: string, type: 'product' | 'search'): Promise<RainforestResponse | null> {
  const apiKey = serverEnv('RAINFOREST_API_KEY');
  if (!apiKey) return null;

  const params = new URLSearchParams({
    api_key: apiKey,
    type,
    amazon_domain: 'amazon.com',
  });

  if (type === 'product') {
    params.set('asin', query);
  } else {
    params.set('search_term', query);
  }

  try {
    const res = await fetch(`https://api.rainforestapi.com/request?${params}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as RainforestResponse;
  } catch {
    return null;
  }
}

/** Amazon serves the same photo at many sizes — keep the highest-res URL per image id. */
function amazonImageKey(url: string): string {
  const match = url.match(/\/images\/[A-Z]\/([A-Za-z0-9+\-_]+)/);
  if (match?.[1]) {
    // Strip size suffixes like ._AC_SL1500_ from the id segment when present
    return match[1].replace(/\._[A-Z0-9_,]+_$/i, '').split('.')[0] ?? match[1];
  }
  return url;
}

function collectImageUrls(product: RainforestProduct): string[] {
  const urls: string[] = [];
  const push = (raw: string | null | undefined) => {
    const url = raw?.trim();
    if (!url || !/^https?:\/\//i.test(url)) return;
    // Skip video files from the image block
    if (/\.(mp4|m3u8)(\?|$)/i.test(url)) return;
    urls.push(url);
  };

  push(product.main_image?.link);
  push(product.image);
  for (const img of product.images ?? []) {
    push(img.link);
  }
  if (product.images_flat) {
    for (const part of product.images_flat.split(',')) {
      push(part);
    }
  }

  // Prefer longer URLs (usually higher resolution) when they share an image id.
  const bestByKey = new Map<string, string>();
  for (const url of urls) {
    const key = amazonImageKey(url);
    const existing = bestByKey.get(key);
    if (!existing || url.length > existing.length) {
      bestByKey.set(key, url);
    }
  }

  // Preserve first-seen order from the product gallery.
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const best = bestByKey.get(amazonImageKey(url));
    if (!best || seen.has(best)) continue;
    seen.add(best);
    ordered.push(best);
  }
  return ordered;
}

function extractImages(product: RainforestProduct): string[] {
  return collectImageUrls(product);
}

function coercePrice(raw: number | { value?: number } | null | undefined): number | null {
  if (raw == null) return null;
  const value = typeof raw === 'number' ? raw : raw.value;
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

/** Prefer product-page Buy Box / one-time price so it matches amazon.com/dp/{asin}. */
function extractPrice(product: RainforestProduct): number | null {
  return (
    coercePrice(product.buybox_winner?.one_time_price) ??
    coercePrice(product.buybox_winner?.price) ??
    coercePrice(product.price)
  );
}

const ASIN_RE = /^B0[A-Z0-9]{8}$/i;

/**
 * Search snippets often show a different price than the product page.
 * When we have an ASIN, re-fetch type=product so retailPrice matches the /dp/ link.
 */
async function hydrateFromProductPage(data: AmazonProductData): Promise<AmazonProductData> {
  const asin = data.asin?.trim();
  if (!asin || !ASIN_RE.test(asin)) return data;

  const byAsin = await fetchRainforest(asin.toUpperCase(), 'product');
  if (!byAsin?.product?.title) return data;

  const mapped = mapProduct(byAsin.product);
  return {
    ...mapped,
    // Prefer the full product-page gallery; fall back to search thumbnails if empty
    imageUrls: mapped.imageUrls.length ? mapped.imageUrls : data.imageUrls,
    searchUrl: amazonProductPageUrl(mapped.asin, mapped.searchUrl) ?? data.searchUrl,
  };
}

function mapProduct(product: RainforestProduct): AmazonProductData {
  return {
    asin: product.asin ?? null,
    title: product.title?.trim() || '',
    description: product.description?.trim() || '',
    imageUrls: extractImages(product),
    retailPrice: extractPrice(product),
    brand: product.brand,
    searchUrl: product.link,
  };
}

function amazonProductPageUrl(asin: string | null | undefined, fallbackLink?: string | null): string | undefined {
  const id = asin?.trim();
  if (id) return `https://www.amazon.com/dp/${id}`;
  return fallbackLink?.trim() || undefined;
}

/** Look up a product on Amazon by ASIN or search term. */
export async function lookupAmazon(query: string, asin?: string | null): Promise<AmazonProductData | null> {
  const trimmed = (asin || query).trim();
  if (!trimmed) return null;

  if (ASIN_RE.test(trimmed)) {
    const byAsin = await fetchRainforest(trimmed.toUpperCase(), 'product');
    if (byAsin?.product?.title) {
      const mapped = mapProduct(byAsin.product);
      return {
        ...mapped,
        searchUrl: amazonProductPageUrl(mapped.asin, mapped.searchUrl) ?? mapped.searchUrl,
      };
    }
  }

  const search = await fetchRainforest(query.trim(), 'search');
  const first = search?.search_results?.[0] ?? search?.product;
  if (!first?.title) return null;
  const mapped = mapProduct(first);
  const withUrl: AmazonProductData = {
    ...mapped,
    searchUrl: amazonProductPageUrl(mapped.asin, mapped.searchUrl) ?? mapped.searchUrl,
  };
  return hydrateFromProductPage(withUrl);
}

/**
 * Try several Amazon queries in order (e.g. UPC, then title) and return the first hit.
 * Deduplicates identical queries so Rainforest is not called twice for the same term.
 */
export async function lookupAmazonWithQueries(queries: Array<string | null | undefined>): Promise<AmazonProductData | null> {
  const seen = new Set<string>();
  for (const raw of queries) {
    const query = raw?.trim();
    if (!query) continue;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const hit = await lookupAmazon(query, null);
    if (hit?.title) return hit;
  }
  return null;
}

/** Search Amazon and return multiple candidates for ambiguous UPC/name matches. */
export async function searchAmazon(query: string, limit = 3): Promise<AmazonProductData[]> {
  const search = await fetchRainforest(query.trim(), 'search');
  const results = search?.search_results ?? (search?.product ? [search.product] : []);
  const mapped = results
    .filter(r => r.title)
    .slice(0, limit)
    .map(product => {
      const item = mapProduct(product);
      return {
        ...item,
        searchUrl: amazonProductPageUrl(item.asin, item.searchUrl) ?? item.searchUrl,
      };
    });

  // Hydrate each ASIN against the product page so candidate prices match /dp/ links.
  return Promise.all(mapped.map(hydrateFromProductPage));
}

/** Search Amazon with fallback queries until at least one candidate is found. */
export async function searchAmazonWithQueries(
  queries: Array<string | null | undefined>,
  limit = 5,
): Promise<AmazonProductData[]> {
  const seen = new Set<string>();
  for (const raw of queries) {
    const query = raw?.trim();
    if (!query) continue;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const results = await searchAmazon(query, limit);
    if (results.length) return results;
  }
  return [];
}
