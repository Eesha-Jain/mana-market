import 'server-only';

import { serverEnv } from '@/lib/env/server';

interface UpcOffer {
  merchant?: string;
  domain?: string;
  title?: string;
  price?: string | number;
  link?: string;
  updated_t?: number;
  condition?: string;
  availability?: string;
}

interface UpcItem {
  title?: string;
  description?: string;
  brand?: string;
  images?: string[];
  upc?: string;
  offers?: UpcOffer[];
  lowest_recorded_price?: number | null;
  highest_recorded_price?: number | null;
}

export interface UpcStoreOffer {
  /** Stable unique id for market-price selection (merchant + domain + price). */
  id: string;
  merchant: string;
  domain: string;
  title: string;
  price: number;
  link?: string;
  updatedAt?: string;
}

export interface UpcData {
  title: string | null;
  description: string;
  brand: string;
  imageUrls: string[];
  upc: string;
  lowestPrice: number | null;
  highestPrice: number | null;
  avgOfferPrice: number | null;
  /** Individual shopping-info rows from UPC Item DB (eBay, Walmart, etc.). */
  storeOffers: UpcStoreOffer[];
}

function parseOfferPrice(raw: string | number | undefined): number | null {
  if (raw == null || raw === '') return null;
  const value = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[$,]/g, ''));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'store';
}

function buildOfferId(merchant: string, domain: string, price: number, index: number): string {
  // Include merchant + price so Walmart.com vs Walmart Marketplace stay distinct
  // even when they share the same domain.
  return `upc_store:${slugPart(domain)}:${slugPart(merchant)}:${price.toFixed(2)}:${index}`;
}

function normalizeStoreOffer(offer: UpcOffer, index: number): UpcStoreOffer | null {
  const price = parseOfferPrice(offer.price);
  if (price == null) return null;

  const merchant = (offer.merchant || offer.domain || '').trim();
  if (!merchant) return null;

  const domain = (offer.domain || merchant).trim().toLowerCase();
  const updatedAt =
    offer.updated_t && Number.isFinite(offer.updated_t)
      ? new Date(offer.updated_t * 1000).toISOString()
      : undefined;

  return {
    id: buildOfferId(merchant, domain, price, index),
    merchant,
    domain,
    title: (offer.title || '').trim(),
    price,
    link: offer.link?.trim() || undefined,
    updatedAt,
  };
}

/** Prefer fresher offers first (matches UPC Item DB "Last Updated" ordering). */
function sortStoreOffers(offers: UpcStoreOffer[]): UpcStoreOffer[] {
  return [...offers].sort((a, b) => {
    const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return tb - ta;
  });
}

/**
 * Collapse only exact duplicates (same merchant + domain + price).
 * Do NOT collapse by domain alone — Walmart Marketplace and Wal-Mart.com both use walmart.com.
 */
function dedupeExactOffers(offers: UpcStoreOffer[]): UpcStoreOffer[] {
  const seen = new Set<string>();
  const out: UpcStoreOffer[] = [];
  for (const offer of offers) {
    const key = `${offer.domain}|${offer.merchant.toLowerCase()}|${offer.price.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(offer);
  }
  return out;
}

async function fetchUpcLookup(upc: string): Promise<{ items?: UpcItem[] } | null> {
  const apiKey = serverEnv('UPCITEMDB_API_KEY');
  // Paid plans use /prod/v1 with user_key; free trial returns a subset of shopping-info rows.
  const url = apiKey
    ? `https://api.upcitemdb.com/prod/v1/lookup?upc=${encodeURIComponent(upc)}`
    : `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(upc)}`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) {
    headers.user_key = apiKey;
    headers.key_type = '3scale';
  }

  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return (await res.json()) as { items?: UpcItem[] };
}

export async function lookupUPC(upc: string): Promise<UpcData | null> {
  if (!upc || !/^\d{8,14}$/.test(upc)) return null;
  try {
    const data = await fetchUpcLookup(upc);
    if (!data?.items?.length) return null;
    const item = data.items[0]!;

    const storeOffers = dedupeExactOffers(
      sortStoreOffers(
        (item.offers || [])
          .map((offer, index) => normalizeStoreOffer(offer, index))
          .filter((o): o is UpcStoreOffer => o != null),
      ),
    );

    const prices = storeOffers.map(o => o.price);
    const avgOfferPrice = prices.length
      ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
      : null;

    return {
      title: item.title || null,
      description: item.description || '',
      brand: item.brand || '',
      imageUrls: item.images || [],
      upc: item.upc || upc,
      lowestPrice: item.lowest_recorded_price ?? null,
      highestPrice: item.highest_recorded_price ?? null,
      avgOfferPrice,
      storeOffers,
    };
  } catch {
    return null;
  }
}
