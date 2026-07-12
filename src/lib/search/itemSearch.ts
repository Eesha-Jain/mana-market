import 'server-only';

import type {
  ImageCandidate,
  ImageCandidateSource,
  MarketPriceOption,
  MarketPriceSource,
  PriceRange,
  Product,
} from '@/types';
import {
  aggregateEbayPricing,
  collectEbayImages,
  fetchEbayItems,
  parseEbayItem,
  uniqueUrls,
  type EbayAgg,
  type EbayRawItem,
} from '@/lib/search/ebayClient';
import { lookupUPC, type UpcData } from '@/lib/search/upcLookup';

function mergeImageUrls(...lists: Array<(string | null | undefined)[] | undefined>): string[] {
  return uniqueUrls(lists.flat().filter(Boolean) as (string | null | undefined)[]);
}

function buildImageCandidates(upcImages: string[] | undefined, ebayImages: string[]): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  const seen = new Set<string>();

  for (const url of upcImages || []) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    candidates.push({ url, source: 'upc_catalog' satisfies ImageCandidateSource });
  }

  for (const url of ebayImages) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    candidates.push({ url, source: 'ebay_sold' satisfies ImageCandidateSource });
  }

  return candidates;
}

function enrichProductImages(product: Product, upcData: UpcData | null, allEbayImages: string[]): void {
  product.imageUrls = mergeImageUrls(
    upcData?.imageUrls,
    product.imageUrls,
    allEbayImages,
  );
  product.imageCandidates = buildImageCandidates(upcData?.imageUrls, allEbayImages);
}

function attachSearchMetadata(result: Record<string, unknown>): Record<string, unknown> {
  if (result.type === 'found') {
    const product = result.product as Product;
    const missingFields = product.imageUrls.length ? [] : ['image'];
    return {
      ...result,
      missingFields,
      imageCandidates: product.imageCandidates || buildImageCandidates([], product.imageUrls),
    };
  }

  if (result.type === 'ambiguous') {
    const results = result.results as Product[];
    const missingFields = results.some(p => p.imageUrls.length) ? [] : ['image'];
    return {
      ...result,
      missingFields,
      imageCandidates: uniqueUrls(results.flatMap(p => p.imageUrls)).map(url => ({
        url,
        source: 'ebay_sold',
      })),
    };
  }

  return result;
}

function buildMarketPriceOptions(upcData: UpcData | null, ebayAgg: EbayAgg | null): MarketPriceOption[] {
  const options: MarketPriceOption[] = [];

  if (ebayAgg?.avgPrice != null) {
    options.push({
      source: 'ebay_completed',
      price: ebayAgg.avgPrice,
      priceRange: ebayAgg.priceRange,
      soldCount: ebayAgg.soldCount,
    });
  }

  if (upcData?.avgOfferPrice != null) {
    options.push({
      source: 'upc_offers',
      price: upcData.avgOfferPrice,
      priceRange: upcData.lowestPrice != null
        ? { low: upcData.lowestPrice, high: upcData.highestPrice || upcData.lowestPrice }
        : undefined,
    });
  } else if (upcData?.lowestPrice != null) {
    options.push({
      source: 'upc_recorded',
      price: upcData.lowestPrice,
      priceRange: {
        low: upcData.lowestPrice,
        high: upcData.highestPrice || upcData.lowestPrice,
      },
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

  const primary = options.find(o => o.source === 'ebay_completed') ?? options[0]!;
  product.marketPrice = primary.price;
  product.marketPriceSource = primary.source;
  if (primary.priceRange) product.priceRange = primary.priceRange;
  if (primary.soldCount != null) product.soldCount = primary.soldCount;
}

interface BuildProductInput {
  title?: string | null;
  description?: string;
  brand?: string;
  imageUrls?: string[];
  upc?: string | null;
  marketPrice?: number | null;
  marketPriceSource?: MarketPriceSource | null;
  marketPriceOptions?: MarketPriceOption[] | null;
  priceRange?: PriceRange | null;
  soldCount?: number | null;
  query: string;
}

function buildProductFromSources(input: BuildProductInput): Product {
  const {
    title,
    description,
    brand,
    imageUrls,
    upc,
    marketPrice,
    marketPriceSource,
    marketPriceOptions,
    priceRange,
    soldCount,
    query,
  } = input;
  const displayTitle = title || query;
  const urls = (imageUrls || []).filter(Boolean);
  const product: Product = {
    title: displayTitle,
    description: description || '',
    brand: brand || 'Wizards of the Coast',
    imageUrls: urls,
    imageCandidates: urls.map(url => ({ url, source: 'ebay_sold' satisfies ImageCandidateSource })),
    upc: upc || undefined,
    marketPrice: marketPrice ?? undefined,
    marketPriceSource: marketPriceSource ?? undefined,
    marketPriceOptions: marketPriceOptions ?? undefined,
    priceRange: priceRange ?? undefined,
    soldCount: soldCount ?? undefined,
    ebaySearchUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(displayTitle + ' magic the gathering')}`,
    tcgplayerUrl: `https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(displayTitle)}`,
  };

  if (marketPriceOptions?.length) {
    applyPrimaryMarketPrice(product, marketPriceOptions);
  }

  return product;
}

function ebayItemsToProducts(ebayRawItems: EbayRawItem[], upcData: UpcData | null, query: string): Product[] {
  const seen = new Set<string>();
  const products: Product[] = [];
  const sharedEbayImages = collectEbayImages(ebayRawItems);

  for (const raw of ebayRawItems) {
    const { title, price, imageUrl } = parseEbayItem(raw);
    if (!title) continue;

    const key = title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);

    products.push(buildProductFromSources({
      title,
      description: upcData?.description || '',
      brand: upcData?.brand,
      imageUrls: mergeImageUrls(upcData?.imageUrls, [imageUrl], sharedEbayImages),
      upc: upcData?.upc || null,
      marketPrice: price,
      marketPriceSource: 'ebay_completed',
      marketPriceOptions: price != null ? [{
        source: 'ebay_completed',
        price,
        soldCount: 1,
      }] : [],
      soldCount: 1,
      query,
    }));

    if (products.length >= 12) break;
  }

  for (const product of products) {
    enrichProductImages(product, upcData, sharedEbayImages);
  }

  return products;
}

function buildProductFromUpcData(upcData: UpcData, ebayAgg: EbayAgg | null, query: string): Product {
  const marketPriceOptions = buildMarketPriceOptions(upcData, ebayAgg);

  const product = buildProductFromSources({
    title: upcData.title,
    description: upcData.description,
    brand: upcData.brand,
    imageUrls: upcData.imageUrls,
    upc: upcData.upc,
    marketPrice: null,
    marketPriceSource: null,
    marketPriceOptions,
    priceRange: ebayAgg?.priceRange ??
      (upcData.lowestPrice
        ? { low: upcData.lowestPrice, high: upcData.highestPrice || upcData.lowestPrice }
        : null),
    soldCount: ebayAgg?.soldCount,
    query: query || upcData.title || '',
  });

  if (ebayAgg?.topImageUrl) {
    product.imageUrls = mergeImageUrls(product.imageUrls, [ebayAgg.topImageUrl]);
  }

  enrichProductImages(product, upcData, ebayAgg?.topImageUrl ? [ebayAgg.topImageUrl] : []);

  return product;
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

function finalizeEbayProducts(
  ebayProducts: Product[],
  ebayAgg: EbayAgg | null,
  upc: string | undefined,
  upcData: UpcData | null,
): Record<string, unknown> | null {
  if (ebayProducts.length > 1) {
    return { type: 'ambiguous', source: 'ebay', results: ebayProducts };
  }

  if (ebayProducts.length === 1) {
    const p = ebayProducts[0]!;
    if (ebayAgg) {
      p.marketPrice = ebayAgg.avgPrice;
      p.priceRange = ebayAgg.priceRange;
      p.soldCount = ebayAgg.soldCount;
      if (ebayAgg.topImageUrl) {
        p.imageUrls = mergeImageUrls(p.imageUrls, [ebayAgg.topImageUrl]);
      }
    }

    const options = buildMarketPriceOptions(upcData, ebayAgg);
    if (options.length) {
      applyPrimaryMarketPrice(p, options);
    }

    if (upc && !p.upc) p.upc = upc;
    return { type: 'found', source: 'ebay', product: p };
  }

  return null;
}

interface SearchTermEntry {
  term: string;
  secondary: string | null;
}

function addSearchTerm(terms: SearchTermEntry[], term: string | undefined, secondary: string | null): void {
  const trimmed = (term || '').trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  if (terms.some(entry => entry.term.toLowerCase() === key)) return;
  terms.push({ term: trimmed, secondary: secondary || null });
}

interface EbayRun {
  term: string;
  rawItems: EbayRawItem[];
  agg: EbayAgg | null;
  products: Product[];
}

async function runEbaySearch(term: string, secondary: string | null, upcData: UpcData | null): Promise<EbayRun | null> {
  const rawItems = await fetchEbayItems(term);
  if (!rawItems.length) return null;

  const agg = aggregateEbayPricing(rawItems);
  let products = ebayItemsToProducts(rawItems, upcData, term);

  if (products.length > 1 && secondary) {
    products = narrowProductsByHint(products, secondary);
  }

  return { term, rawItems, agg, products };
}

// ─── Main unified search ──────────────────────────────────────────────────────
// Bounded enrichment: UPC catalog + up to 3 eBay searches, merging images from all.

export async function searchItem(query: string, upc?: string, sku?: string): Promise<Record<string, unknown>> {
  const title = (query || '').trim();
  const skuTerm = (sku || '').trim();
  const sameText = title && skuTerm && title.toLowerCase() === skuTerm.toLowerCase();

  const upcData = upc ? await lookupUPC(upc) : null;

  const searchTerms: SearchTermEntry[] = [];
  addSearchTerm(searchTerms, title, sameText ? null : skuTerm);
  if (!sameText) addSearchTerm(searchTerms, skuTerm, title);
  if (upcData?.title) addSearchTerm(searchTerms, upcData.title, title || skuTerm);

  const ebayRuns: EbayRun[] = [];
  for (const { term, secondary } of searchTerms.slice(0, 3)) {
    const run = await runEbaySearch(term, secondary, upcData);
    if (run) ebayRuns.push(run);
  }

  const allEbayImages = uniqueUrls(
    ebayRuns.flatMap(run => collectEbayImages(run.rawItems)),
  );

  const bestRun = ebayRuns.find(run => run.products.length) ?? null;
  const bestAgg = bestRun?.agg ?? ebayRuns[0]?.agg ?? null;

  if (upcData?.title) {
    const product = buildProductFromUpcData(
      upcData,
      bestAgg,
      title || skuTerm || upcData.title,
    );
    enrichProductImages(product, upcData, allEbayImages);

    const ebayProducts = bestRun?.products ?? [];
    if (ebayProducts.length > 1) {
      const results = dedupeProducts([product, ...ebayProducts]);
      if (results.length > 1) {
        return attachSearchMetadata({ type: 'ambiguous', source: 'upc+ebay', results });
      }
    }

    if (ebayProducts.length === 1) {
      const ebayProduct = ebayProducts[0]!;
      if (titlesDiverge(product.title, ebayProduct.title)) {
        enrichProductImages(ebayProduct, upcData, allEbayImages);
        return attachSearchMetadata({
          type: 'ambiguous',
          source: 'upc+ebay',
          results: dedupeProducts([product, ebayProduct]),
        });
      }
    }

    return attachSearchMetadata({ type: 'found', source: 'upc_db', product });
  }

  if (bestRun) {
    const result = finalizeEbayProducts(bestRun.products, bestRun.agg, upc, upcData);
    if (result) {
      if (result.type === 'found') {
        enrichProductImages(result.product as Product, upcData, allEbayImages);
      } else {
        for (const product of result.results as Product[]) {
          enrichProductImages(product, upcData, allEbayImages);
        }
      }
      return attachSearchMetadata(result);
    }
  }

  if (ebayRuns.length > 1) {
    for (const run of ebayRuns.slice(1)) {
      const result = finalizeEbayProducts(run.products, run.agg, upc, upcData);
      if (result) {
        if (result.type === 'found') {
          enrichProductImages(result.product as Product, upcData, allEbayImages);
        } else {
          for (const product of result.results as Product[]) {
            enrichProductImages(product, upcData, allEbayImages);
          }
        }
        return attachSearchMetadata(result);
      }
    }
  }

  const fallbackLabel = title || skuTerm;
  if (!fallbackLabel) {
    return { type: 'not_found', missingFields: ['title', 'image'] };
  }

  const missingFields = ['image'];
  if (!upcData?.imageUrls?.length) missingFields.push('market_price');
  return { type: 'not_found', query: fallbackLabel, missingFields };
}
