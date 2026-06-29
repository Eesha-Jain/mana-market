// ─── UPC / Barcode lookup (UPCitemdb — 100/day, no key) ─────────────────────

interface UpcOffer {
  price?: string;
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

interface UpcData {
  title: string | null;
  description: string;
  brand: string;
  imageUrls: string[];
  upc: string;
  lowestPrice: number | null;
  highestPrice: number | null;
  avgOfferPrice: number | null;
}

interface ImageCandidate {
  url: string;
  source: string;
}

interface PriceRange {
  low: number;
  high: number;
}

interface MarketPriceOption {
  source: string;
  price: number;
  priceRange?: PriceRange | null;
  soldCount?: number | null;
}

interface SearchProduct {
  title: string;
  description: string;
  brand: string;
  imageUrls: string[];
  imageCandidates: ImageCandidate[];
  upc: string | null;
  marketPrice: number | null;
  marketPriceSource: string | null;
  marketPriceOptions: MarketPriceOption[] | null;
  priceRange?: PriceRange | null;
  soldCount?: number | null;
  ebaySearchUrl: string;
  tcgplayerUrl: string;
}

interface EbayAgg {
  avgPrice: number;
  soldCount: number;
  topTitle: string | null;
  topImageUrl: string | null;
  priceRange: PriceRange;
}

type EbayRawItem = Record<string, unknown>;

async function lookupUPC(upc: string): Promise<UpcData | null> {
  if (!upc || !/^\d{8,14}$/.test(upc)) return null;
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: UpcItem[] };
    if (!data.items?.length) return null;
    const item = data.items[0]!;

    const prices = (item.offers || [])
      .map(o => parseFloat(o.price ?? ''))
      .filter(p => !isNaN(p) && p > 0);
    const avgOfferPrice = prices.length
      ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100
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
    };
  } catch {
    return null;
  }
}

// ─── eBay Finding API (completed sold listings) ────────────────────────────────

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

function parseEbayItem(raw: EbayRawItem) {
  const title = firstString(raw.title);
  const priceStr = nestedFirstString(raw, 'sellingStatus', 'currentPrice');
  const price = parseFloat(priceStr ?? '');
  const imageUrl =
    firstString(raw.pictureURLLarge) ||
    firstString(raw.galleryURL) ||
    null;
  return { title, price: !isNaN(price) && price > 0 ? price : null, imageUrl };
}

async function fetchEbayItems(keywords: string): Promise<EbayRawItem[]> {
  const appId = process.env.EBAY_APP_ID;
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

// ─── Image enrichment helpers ─────────────────────────────────────────────────

function uniqueUrls(urls: (string | null | undefined)[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls || []) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function mergeImageUrls(...lists: Array<(string | null | undefined)[] | undefined>): string[] {
  return uniqueUrls(lists.flat().filter(Boolean) as (string | null | undefined)[]);
}

function collectEbayImages(rawItems: EbayRawItem[], limit = 12): string[] {
  const urls: string[] = [];
  for (const raw of rawItems) {
    const { imageUrl } = parseEbayItem(raw);
    if (imageUrl) urls.push(imageUrl);
    if (urls.length >= limit) break;
  }
  return uniqueUrls(urls);
}

function buildImageCandidates(upcImages: string[] | undefined, ebayImages: string[]): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  const seen = new Set<string>();

  for (const url of upcImages || []) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    candidates.push({ url, source: 'upc_catalog' });
  }

  for (const url of ebayImages) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    candidates.push({ url, source: 'ebay_sold' });
  }

  return candidates;
}

function enrichProductImages(product: SearchProduct, upcData: UpcData | null, allEbayImages: string[]): void {
  product.imageUrls = mergeImageUrls(
    upcData?.imageUrls,
    product.imageUrls,
    allEbayImages,
  );
  product.imageCandidates = buildImageCandidates(upcData?.imageUrls, allEbayImages);
}

function attachSearchMetadata(result: Record<string, unknown>): Record<string, unknown> {
  if (result.type === 'found') {
    const product = result.product as SearchProduct;
    const missingFields = product.imageUrls.length ? [] : ['image'];
    return {
      ...result,
      missingFields,
      imageCandidates: product.imageCandidates || buildImageCandidates([], product.imageUrls),
    };
  }

  if (result.type === 'ambiguous') {
    const results = result.results as SearchProduct[];
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
      priceRange: ebayAgg.priceRange ?? null,
      soldCount: ebayAgg.soldCount ?? null,
    });
  }

  if (upcData?.avgOfferPrice != null) {
    options.push({
      source: 'upc_offers',
      price: upcData.avgOfferPrice,
      priceRange: upcData.lowestPrice != null
        ? { low: upcData.lowestPrice, high: upcData.highestPrice || upcData.lowestPrice }
        : null,
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

function applyPrimaryMarketPrice(product: SearchProduct, options: MarketPriceOption[]): void {
  product.marketPriceOptions = options;

  if (!options.length) {
    product.marketPrice = null;
    product.marketPriceSource = null;
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
  marketPriceSource?: string | null;
  marketPriceOptions?: MarketPriceOption[] | null;
  priceRange?: PriceRange | null;
  soldCount?: number | null;
  query: string;
}

function buildProductFromSources(input: BuildProductInput): SearchProduct {
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
  const product: SearchProduct = {
    title: displayTitle,
    description: description || '',
    brand: brand || 'Wizards of the Coast',
    imageUrls: urls,
    imageCandidates: urls.map(url => ({ url, source: 'ebay_sold' })),
    upc: upc || null,
    marketPrice: marketPrice ?? null,
    marketPriceSource: marketPriceSource ?? null,
    marketPriceOptions: marketPriceOptions || null,
    priceRange,
    soldCount,
    ebaySearchUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(displayTitle + ' magic the gathering')}`,
    tcgplayerUrl: `https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(displayTitle)}`,
  };

  if (marketPriceOptions?.length) {
    applyPrimaryMarketPrice(product, marketPriceOptions);
  }

  return product;
}

function ebayItemsToProducts(ebayRawItems: EbayRawItem[], upcData: UpcData | null, query: string): SearchProduct[] {
  const seen = new Set<string>();
  const products: SearchProduct[] = [];
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

function aggregateEbayPricing(ebayRawItems: EbayRawItem[]): EbayAgg | null {
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

function buildProductFromUpcData(upcData: UpcData, ebayAgg: EbayAgg | null, query: string): SearchProduct {
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

function dedupeSearchProducts(products: SearchProduct[]): SearchProduct[] {
  const seen = new Set<string>();
  const out: SearchProduct[] = [];
  for (const product of products) {
    const key = product.title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(product);
  }
  return out;
}

/** Rank/filter listing titles using a secondary hint (SKU or product name). */
export function narrowProductsByHint(products: SearchProduct[], hint: string | undefined): SearchProduct[] {
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
  ebayProducts: SearchProduct[],
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
  products: SearchProduct[];
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
      const results = dedupeSearchProducts([product, ...ebayProducts]);
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
          results: dedupeSearchProducts([product, ebayProduct]),
        });
      }
    }

    return attachSearchMetadata({ type: 'found', source: 'upc_db', product });
  }

  if (bestRun) {
    const result = finalizeEbayProducts(bestRun.products, bestRun.agg, upc, upcData);
    if (result) {
      if (result.type === 'found') {
        enrichProductImages(result.product as SearchProduct, upcData, allEbayImages);
      } else {
        for (const product of result.results as SearchProduct[]) {
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
          enrichProductImages(result.product as SearchProduct, upcData, allEbayImages);
        } else {
          for (const product of result.results as SearchProduct[]) {
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
