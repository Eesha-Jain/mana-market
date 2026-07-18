import 'server-only';

import type {
  ImageCandidate,
  ImageCandidateSource,
  MarketPriceOption,
  Product,
} from '@/types';
import {
  lookupAmazonWithQueries,
  searchAmazonWithQueries,
  type AmazonProductData,
} from '@/lib/search/amazonClient';
import { lookupUPC, type UpcData } from '@/lib/search/upcLookup';

function uniqueUrls(urls: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function mergeImageUrls(...lists: Array<(string | null | undefined)[] | undefined>): string[] {
  return uniqueUrls(lists.flat().filter(Boolean) as (string | null | undefined)[]);
}

function buildImageCandidates(
  amazonImages: string[],
  upcImages: string[] | undefined,
): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  const seen = new Set<string>();

  for (const url of amazonImages) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    candidates.push({ url, source: 'amazon_catalog' satisfies ImageCandidateSource });
  }

  for (const url of upcImages || []) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    candidates.push({ url, source: 'upc_catalog' satisfies ImageCandidateSource });
  }

  return candidates;
}

function buildMarketPriceOptions(
  amazonPrice: number | null,
  upcData: UpcData | null,
): MarketPriceOption[] {
  const options: MarketPriceOption[] = [];

  if (amazonPrice != null) {
    options.push({
      id: 'amazon_retail',
      source: 'amazon_retail',
      price: amazonPrice,
      label: 'Amazon',
    });
  }

  for (const offer of upcData?.storeOffers ?? []) {
    options.push({
      id: offer.id,
      source: 'upc_store',
      price: offer.price,
      label: offer.merchant,
      url: offer.link,
      updatedAt: offer.updatedAt,
    });
  }

  // Fallback summary when the API returns prices but no per-store rows.
  if (!(upcData?.storeOffers?.length) && upcData?.avgOfferPrice != null) {
    options.push({
      id: 'upc_offers',
      source: 'upc_offers',
      price: upcData.avgOfferPrice,
      priceRange:
        upcData.lowestPrice != null
          ? { low: upcData.lowestPrice, high: upcData.highestPrice || upcData.lowestPrice }
          : undefined,
      label: 'UPC catalog average',
    });
  } else if (!(upcData?.storeOffers?.length) && upcData?.lowestPrice != null) {
    options.push({
      id: 'upc_recorded',
      source: 'upc_recorded',
      price: upcData.lowestPrice,
      priceRange: {
        low: upcData.lowestPrice,
        high: upcData.highestPrice || upcData.lowestPrice,
      },
      label: 'UPC recorded low',
    });
  }

  return options;
}

function applyPrimaryMarketPrice(product: Product, options: MarketPriceOption[]): void {
  product.marketPriceOptions = options;
  if (!options.length) {
    product.marketPrice = undefined;
    product.marketPriceSource = undefined;
    return;
  }

  const primary = options.find(o => o.source === 'amazon_retail') ?? options[0]!;
  product.marketPrice = primary.price;
  product.marketPriceSource = primary.source;
  if (primary.priceRange) product.priceRange = primary.priceRange;
}

interface BuildProductInput {
  title?: string | null;
  description?: string;
  brand?: string;
  imageUrls?: string[];
  upc?: string | null;
  asin?: string | null;
  amazonPrice?: number | null;
  amazonUrl?: string | null;
  upcData?: UpcData | null;
  query: string;
}

function resolveAmazonUrl(
  asin: string | null | undefined,
  amazonUrl: string | null | undefined,
  displayTitle: string,
): string {
  const id = asin?.trim();
  if (id) return `https://www.amazon.com/dp/${id}`;
  if (amazonUrl?.trim()) return amazonUrl.trim();
  return `https://www.amazon.com/s?k=${encodeURIComponent(displayTitle)}`;
}

function buildProduct(input: BuildProductInput): Product {
  const displayTitle = input.title?.trim() || input.query;
  const imageUrls = mergeImageUrls(input.imageUrls, input.upcData?.imageUrls);
  const options = buildMarketPriceOptions(input.amazonPrice ?? null, input.upcData ?? null);

  const product: Product = {
    title: displayTitle,
    description: input.description || input.upcData?.description || '',
    brand: input.brand || input.upcData?.brand,
    imageUrls,
    imageCandidates: buildImageCandidates(input.imageUrls || [], input.upcData?.imageUrls),
    upc: input.upc || input.upcData?.upc || undefined,
    asin: input.asin || undefined,
    amazonSearchUrl: resolveAmazonUrl(input.asin, input.amazonUrl, displayTitle),
  };

  applyPrimaryMarketPrice(product, options);
  return product;
}

function productFromAmazon(
  amazon: AmazonProductData,
  upc: string | undefined,
  upcData: UpcData | null,
  searchLabel: string,
): Product {
  return buildProduct({
    title: amazon.title,
    description: amazon.description || upcData?.description,
    brand: amazon.brand || upcData?.brand,
    imageUrls: amazon.imageUrls,
    upc: upc || upcData?.upc,
    asin: amazon.asin,
    amazonPrice: amazon.retailPrice,
    amazonUrl: amazon.searchUrl,
    upcData,
    query: searchLabel,
  });
}

/** Prefer barcode/title queries that best identify the sold product on Amazon. */
function amazonQueryCandidates(opts: {
  upc?: string;
  title?: string;
  upcTitle?: string | null;
  sku?: string;
}): string[] {
  return [opts.upc, opts.title, opts.upcTitle ?? undefined, opts.sku]
    .map(v => v?.trim())
    .filter((v): v is string => Boolean(v));
}

function attachSearchMetadata(result: Record<string, unknown>): Record<string, unknown> {
  if (result.type === 'found') {
    const product = result.product as Product;
    const missingFields = product.imageUrls.length ? [] : ['image'];
    return { ...result, missingFields };
  }

  if (result.type === 'ambiguous') {
    const results = result.results as Product[];
    const missingFields = results.some(p => p.imageUrls.length) ? [] : ['image'];
    return { ...result, missingFields };
  }

  return result;
}

function dedupeProducts(products: Product[]): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const product of products) {
    const key = product.title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(product);
  }
  return out;
}

function titlesDiverge(a: string, b: string): boolean {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return false;
  const tokensA = na.split(/[\s/\-_,]+/).filter(t => t.length >= 3);
  const tokensB = new Set(nb.split(/[\s/\-_,]+/).filter(t => t.length >= 3));
  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap++;
  }
  return overlap < 2;
}

/** Rank/filter listing titles using a secondary hint (SKU or product name). */
export function narrowProductsByHint(products: Product[], hint: string | undefined): Product[] {
  const needle = (hint || '').trim().toLowerCase();
  if (!needle || !products.length) return products;

  const tokens = needle.split(/[\s/\-_,]+/).filter(t => t.length >= 2);
  const matches = products.filter(p => {
    const title = p.title.toLowerCase();
    if (title.includes(needle)) return true;
    if (!tokens.length) return false;
    return tokens.every(t => title.includes(t));
  });

  return matches.length ? matches : products;
}

import { productToCatalogSnapshot } from '@/utils/items';

export { productToCatalogSnapshot };
// Amazon-first enrichment with UPC catalog fallback.

export async function searchItem(
  query: string,
  upc?: string,
  sku?: string,
): Promise<Record<string, unknown>> {
  const title = (query || '').trim();
  const skuTerm = (sku || '').trim();
  const searchLabel = title || skuTerm || upc || '';

  const upcData = upc ? await lookupUPC(upc) : null;

  const amazonQueries = amazonQueryCandidates({
    upc,
    title,
    upcTitle: upcData?.title,
    sku: skuTerm,
  });
  const amazonData = await lookupAmazonWithQueries(amazonQueries);

  if (amazonData?.title) {
    const product = productFromAmazon(amazonData, upc, upcData, searchLabel);

    if (upcData?.title && titlesDiverge(product.title, upcData.title)) {
      const upcProduct = buildProduct({
        title: upcData.title,
        description: upcData.description,
        brand: upcData.brand,
        imageUrls: upcData.imageUrls,
        upc: upcData.upc,
        amazonPrice: amazonData.retailPrice,
        amazonUrl: amazonData.searchUrl,
        upcData,
        query: searchLabel,
      });
      return attachSearchMetadata({
        type: 'ambiguous',
        source: 'amazon+upc',
        results: dedupeProducts([product, upcProduct]),
      });
    }

    return attachSearchMetadata({ type: 'found', source: 'amazon', product });
  }

  if (upcData?.title) {
    const product = buildProduct({
      title: upcData.title,
      description: upcData.description,
      brand: upcData.brand,
      imageUrls: upcData.imageUrls,
      upc: upcData.upc,
      amazonPrice: null,
      upcData,
      query: searchLabel,
    });
    return attachSearchMetadata({ type: 'found', source: 'upc', product });
  }

  const amazonCandidates = await searchAmazonWithQueries(amazonQueries, 5);
  if (amazonCandidates.length > 1) {
    const results = amazonCandidates.map(candidate =>
      productFromAmazon(candidate, upc, upcData, searchLabel),
    );
    const narrowed = skuTerm ? narrowProductsByHint(results, skuTerm) : results;
    if (narrowed.length > 1) {
      return attachSearchMetadata({ type: 'ambiguous', source: 'amazon', results: narrowed });
    }
    if (narrowed.length === 1) {
      return attachSearchMetadata({ type: 'found', source: 'amazon', product: narrowed[0]! });
    }
  }

  if (amazonCandidates.length === 1) {
    const product = productFromAmazon(amazonCandidates[0]!, upc, upcData, searchLabel);
    return attachSearchMetadata({ type: 'found', source: 'amazon', product });
  }

  if (!searchLabel) {
    return { type: 'not_found', missingFields: ['title', 'image'] };
  }

  const missingFields = ['image', 'market_price'];
  return { type: 'not_found', query: searchLabel, missingFields };
}
