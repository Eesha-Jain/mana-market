import type { ItemListing, MarketPriceOption, MarketPricePreference, MarketPriceSource, Product } from '../types';

export function getMarketPriceOptions(product: Product | null | undefined): MarketPriceOption[] {
  if (!product) return [];

  if (product.marketPriceOptions?.length) {
    return product.marketPriceOptions;
  }

  if (product.marketPrice != null && product.marketPriceSource) {
    return [{
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
  if (preference === 'ebay') {
    return options.find(o => o.source === 'ebay_completed') ?? null;
  }

  if (preference === 'upc') {
    return options.find(o => o.source === 'upc_offers' || o.source === 'upc_recorded') ?? null;
  }

  return null;
}

function findOptionBySource(
  options: MarketPriceOption[],
  source: MarketPriceSource,
): MarketPriceOption | null {
  return options.find(o => o.source === source) ?? null;
}

/** Resolve the active market price for a product given user/item preferences. */
export function resolveProductMarketPrice(
  product: Product | null | undefined,
  preference: MarketPricePreference = 'ebay',
  selectedSource?: MarketPriceSource | null,
): number | null {
  return resolveProductMarketSelection(product, preference, selectedSource).price;
}

export function resolveProductMarketSelection(
  product: Product | null | undefined,
  preference: MarketPricePreference = 'ebay',
  selectedSource?: MarketPriceSource | null,
): { price: number | null; source: MarketPriceSource | null } {
  const options = getMarketPriceOptions(product);
  if (!options.length) return { price: null, source: null };

  if (preference === 'show_all') {
    if (selectedSource) {
      const picked = findOptionBySource(options, selectedSource);
      if (picked) return { price: picked.price, source: picked.source };
    }
    const first = options[0]!;
    return { price: first.price, source: first.source };
  }

  const preferred = findOptionForPreference(options, preference);
  if (preferred) return { price: preferred.price, source: preferred.source };

  const fallback = options[0]!;
  return { price: fallback.price, source: fallback.source };
}

export function resolveItemMarketPrice(item: ItemListing): number | null {
  return resolveProductMarketPrice(
    item.product,
    item.marketPricePreference ?? 'ebay',
    item.selectedMarketPriceSource,
  );
}

export function resolveItemMarketSelection(item: ItemListing): {
  price: number | null;
  source: MarketPriceSource | null;
} {
  return resolveProductMarketSelection(
    item.product,
    item.marketPricePreference ?? 'ebay',
    item.selectedMarketPriceSource,
  );
}

/** Pick an initial selected source when opening review/detail forms. */
export function resolveInitialSelectedSource(
  product: Product | null | undefined,
  preference: MarketPricePreference,
): MarketPriceSource | undefined {
  const options = getMarketPriceOptions(product);
  if (!options.length) return undefined;

  if (preference === 'show_all') {
    return options.length === 1 ? options[0]!.source : undefined;
  }

  const preferred = findOptionForPreference(options, preference);
  if (preferred) return preferred.source;
  return options[0]!.source;
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
