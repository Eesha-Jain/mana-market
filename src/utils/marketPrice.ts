import type {
  ItemListing,
  MarketPriceOption,
  MarketPricePreference,
  MarketPriceSource,
  Product,
  UserItemWithCatalog,
} from '../types';

/** Stable id used for radio selection / persistence. */
export function getMarketPriceOptionId(option: MarketPriceOption): string {
  return option.id?.trim() || option.source;
}

export function optionDisplayLabel(option: MarketPriceOption): string {
  if (option.label?.trim()) return option.label.trim();
  if (option.source === 'amazon_retail') return 'Amazon';
  if (option.source === 'upc_recorded') return 'UPC recorded low';
  if (option.source === 'upc_offers') return 'UPC catalog average';
  return 'Market price';
}

export function isUpcMarketSource(source: MarketPriceSource | null | undefined): boolean {
  return source === 'upc_store' || source === 'upc_offers' || source === 'upc_recorded';
}

/** Amazon product page when ASIN is known; otherwise title/search URL. */
export function getAmazonProductUrl(product: Product | null | undefined): string | undefined {
  if (!product) return undefined;
  const asin = product.asin?.trim();
  if (asin) return `https://www.amazon.com/dp/${asin}`;
  return product.amazonSearchUrl?.trim() || undefined;
}

/** Public UPC Item DB page for the barcode. */
export function getUpcCatalogUrl(product: Product | null | undefined): string | undefined {
  const upc = product?.upc?.trim();
  if (!upc || !/^\d{8,14}$/.test(upc)) return undefined;
  return `https://www.upcitemdb.com/upc/${upc}`;
}

/** External listing/catalog URL for a market price option or source. */
export function getMarketPriceSourceUrl(
  product: Product | null | undefined,
  source: MarketPriceSource | string | null | undefined,
): string | undefined {
  if (!product || !source) return undefined;

  const options = getMarketPriceOptions(product);
  const byId = options.find(o => getMarketPriceOptionId(o) === source);
  if (byId?.url) return byId.url;

  const bySource = options.find(o => o.source === source);
  if (bySource?.url) return bySource.url;

  if (source === 'amazon_retail' || byId?.source === 'amazon_retail') {
    return getAmazonProductUrl(product);
  }
  if (
    source === 'upc_offers' ||
    source === 'upc_recorded' ||
    source === 'upc_store' ||
    isUpcMarketSource(byId?.source) ||
    String(source).startsWith('upc_store:')
  ) {
    return getUpcCatalogUrl(product);
  }
  if (source === 'ebay_completed') return product.ebaySearchUrl?.trim() || undefined;
  if (source === 'tcgplayer_market') return product.tcgplayerUrl?.trim() || undefined;
  return undefined;
}

export function getMarketPriceOptions(product: Product | null | undefined): MarketPriceOption[] {
  if (!product) return [];

  if (product.marketPriceOptions?.length) {
    return product.marketPriceOptions;
  }

  if (product.marketPrice != null && product.marketPriceSource) {
    return [{
      id: product.marketPriceSource,
      source: product.marketPriceSource,
      price: product.marketPrice,
      priceRange: product.priceRange,
      soldCount: product.soldCount,
    }];
  }

  return [];
}

function findOptionForPreference(
  options: MarketPriceOption[],
  preference: MarketPricePreference,
): MarketPriceOption | null {
  if (preference === 'amazon') {
    return options.find(o => o.source === 'amazon_retail') ?? null;
  }

  if (preference === 'upc') {
    return (
      options.find(o => o.source === 'upc_store') ??
      options.find(o => o.source === 'upc_offers' || o.source === 'upc_recorded') ??
      null
    );
  }

  return null;
}

function findOptionById(
  options: MarketPriceOption[],
  selectedId: string,
): MarketPriceOption | null {
  return (
    options.find(o => getMarketPriceOptionId(o) === selectedId) ??
    options.find(o => o.source === selectedId) ??
    null
  );
}

/** Resolve the active market price for a product given user/item preferences. */
export function resolveProductMarketPrice(
  product: Product | null | undefined,
  preference: MarketPricePreference = 'amazon',
  selectedSource?: string | null,
): number | null {
  return resolveProductMarketSelection(product, preference, selectedSource).price;
}

export function resolveProductMarketSelection(
  product: Product | null | undefined,
  preference: MarketPricePreference = 'amazon',
  selectedSource?: string | null,
): { price: number | null; source: MarketPriceSource | null; optionId: string | null } {
  const options = getMarketPriceOptions(product);
  if (!options.length) return { price: null, source: null, optionId: null };

  // Explicit per-item pick always wins (dropdown / saved selection).
  if (selectedSource) {
    const picked = findOptionById(options, selectedSource);
    if (picked) {
      return {
        price: picked.price,
        source: picked.source,
        optionId: getMarketPriceOptionId(picked),
      };
    }
  }

  if (preference === 'show_all') {
    const first = options[0]!;
    return {
      price: first.price,
      source: first.source,
      optionId: getMarketPriceOptionId(first),
    };
  }

  const preferred = findOptionForPreference(options, preference);
  if (preferred) {
    return {
      price: preferred.price,
      source: preferred.source,
      optionId: getMarketPriceOptionId(preferred),
    };
  }

  const fallback = options[0]!;
  return {
    price: fallback.price,
    source: fallback.source,
    optionId: getMarketPriceOptionId(fallback),
  };
}

function productFromListingItem(item: ItemListing): Product | null {
  const legacyProduct = (item as { product?: Product }).product;
  if (legacyProduct) return legacyProduct;

  const withCatalog = item as UserItemWithCatalog;
  const catalog = withCatalog.catalog;
  if (!catalog) return null;

  const snapshot = catalog.catalogSnapshot;
  return {
    title: withCatalog.customTitle ?? catalog.title,
    description: withCatalog.customDescription ?? catalog.description,
    imageUrls: snapshot.imageUrls ?? [],
    imageCandidates: snapshot.imageCandidates,
    brand: snapshot.brand,
    upc: catalog.upc ?? withCatalog.originalUpc ?? undefined,
    asin: catalog.asin ?? undefined,
    marketPrice: snapshot.amazonPrice ?? snapshot.upcPrice,
    marketPriceOptions: snapshot.marketPriceOptions,
    priceRange: snapshot.priceRange,
    amazonSearchUrl: catalog.asin
      ? `https://www.amazon.com/dp/${catalog.asin}`
      : undefined,
  };
}

export function resolveItemMarketPrice(item: ItemListing): number | null {
  return resolveProductMarketPrice(
    productFromListingItem(item),
    (item as { marketPricePreference?: MarketPricePreference }).marketPricePreference ?? 'amazon',
    item.selectedMarketPriceSource,
  );
}

export function resolveItemMarketSelection(item: ItemListing): {
  price: number | null;
  source: MarketPriceSource | null;
  optionId: string | null;
} {
  return resolveProductMarketSelection(
    productFromListingItem(item),
    (item as { marketPricePreference?: MarketPricePreference }).marketPricePreference ?? 'amazon',
    item.selectedMarketPriceSource,
  );
}

/** Pick an initial selected source when opening review/detail forms. */
export function resolveInitialSelectedSource(
  product: Product | null | undefined,
  preference: MarketPricePreference,
): string | undefined {
  const options = getMarketPriceOptions(product);
  if (!options.length) return undefined;

  if (preference === 'show_all') {
    return getMarketPriceOptionId(options[0]!);
  }

  const preferred = findOptionForPreference(options, preference);
  if (preferred) return getMarketPriceOptionId(preferred);
  return getMarketPriceOptionId(options[0]!);
}

export function shouldShowMarketPricePicker(
  product: Product | null | undefined,
  preference: MarketPricePreference,
): boolean {
  const options = getMarketPriceOptions(product);
  if (options.length <= 1) return false;
  return preference === 'show_all';
}

export function hasMultipleMarketPriceOptions(product: Product | null | undefined): boolean {
  return getMarketPriceOptions(product).length > 1;
}

export function formatOfferUpdatedAt(iso: string | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const ageMs = Date.now() - ms;
  if (ageMs >= 0 && ageMs < 60 * 60 * 1000) return 'Updated just now';
  try {
    return `Updated ${new Date(ms).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })}`;
  } catch {
    return null;
  }
}
