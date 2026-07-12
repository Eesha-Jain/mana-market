import 'server-only';

import { serverEnv } from '@/lib/env/server';
import type { PriceRange } from '@/types';

export interface EbayAgg {
  avgPrice: number;
  soldCount: number;
  topTitle: string | null;
  topImageUrl: string | null;
  priceRange: PriceRange;
}

export type EbayRawItem = Record<string, unknown>;

function firstString(value: unknown): string | null {
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}

function nestedFirstString(obj: unknown, ...keys: string[]): string | null {
  let current: unknown = obj;
  for (const key of keys) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[key];
  }
  if (Array.isArray(current) && current[0] && typeof current[0] === 'object') {
    const inner = current[0] as Record<string, unknown>;
    const val = inner['__value__'];
    return typeof val === 'string' ? val : null;
  }
  return null;
}

export function parseEbayItem(raw: EbayRawItem) {
  const title = firstString(raw.title);
  const priceStr = nestedFirstString(raw, 'sellingStatus', 'currentPrice');
  const price = parseFloat(priceStr ?? '');
  const imageUrl =
    firstString(raw.pictureURLLarge) ||
    firstString(raw.galleryURL) ||
    null;
  return { title, price: !isNaN(price) && price > 0 ? price : null, imageUrl };
}

export async function fetchEbayItems(keywords: string): Promise<EbayRawItem[]> {
  const appId = serverEnv('EBAY_APP_ID');
  if (!appId || !keywords) return [];

  const searchTerm = `${keywords} magic the gathering`;

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    sortOrder: 'EndTimeSoonest',
    'paginationInput.entriesPerPage': '25',
    outputSelector: 'PictureURLLarge',
    keywords: searchTerm,
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
  });

  try {
    const res = await fetch(
      `https://svcs.ebay.com/services/search/FindingService/v1?${params}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      findCompletedItemsResponse?: Array<{
        searchResult?: Array<{ item?: EbayRawItem[] }>;
      }>;
    };
    return data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
  } catch {
    return [];
  }
}

export function uniqueUrls(urls: (string | null | undefined)[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls || []) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function collectEbayImages(rawItems: EbayRawItem[], limit = 12): string[] {
  const urls: string[] = [];
  for (const raw of rawItems) {
    const { imageUrl } = parseEbayItem(raw);
    if (imageUrl) urls.push(imageUrl);
    if (urls.length >= limit) break;
  }
  return uniqueUrls(urls);
}

export function aggregateEbayPricing(ebayRawItems: EbayRawItem[]): EbayAgg | null {
  const prices = ebayRawItems
    .map(i => parseEbayItem(i).price)
    .filter((p): p is number => p !== null);

  if (!prices.length) return null;

  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100;
  const top = parseEbayItem(ebayRawItems[0]!);

  return {
    avgPrice,
    soldCount: prices.length,
    topTitle: top.title,
    topImageUrl: top.imageUrl,
    priceRange: { low: Math.min(...prices), high: Math.max(...prices) },
  };
}
