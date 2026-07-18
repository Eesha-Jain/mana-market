import type {
  CatalogItem,
  MarketPriceOption,
  MarketPricePreference,
  MarketPriceSource,
  PricingCalculationInput,
  Product,
  UserItemWithCatalog,
} from '../types';
import {
  getMarketPriceOptionId,
  isUpcMarketSource,
} from './marketPrice';

export type { PricingCalculationInput } from '../types';

/** Compute listing price from market data and pricing preferences (draft or saved item). */
export function calculateDraftPrice(
  marketPrice: number | null,
  pricing: PricingCalculationInput,
): number | null {
  if (pricing.pricingMode === 'manual') {
    return pricing.manualPrice > 0 ? pricing.manualPrice : null;
  }

  if (marketPrice === null) {
    return pricing.manualPrice > 0 ? pricing.manualPrice : null;
  }

  if (pricing.pricingMode === 'market') return marketPrice;

  const discount = Math.min(Math.max(pricing.percentBelow, 0), 99);
  return Math.round(marketPrice * (1 - discount / 100) * 100) / 100;
}

function snapshotToOptions(catalog: CatalogItem | null | undefined): MarketPriceOption[] {
  if (!catalog) return [];
  const snapshot = catalog.catalogSnapshot;
  if (snapshot.marketPriceOptions?.length) return snapshot.marketPriceOptions;

  const options: MarketPriceOption[] = [];
  if (snapshot.amazonPrice != null) {
    options.push({
      id: 'amazon_retail',
      source: 'amazon_retail',
      price: snapshot.amazonPrice,
      label: 'Amazon',
    });
  }
  if (snapshot.upcPrice != null) {
    options.push({
      id: 'upc_offers',
      source: 'upc_offers',
      price: snapshot.upcPrice,
      label: 'UPC catalog',
    });
  }
  return options;
}

export function getMarketPriceOptions(item: UserItemWithCatalog): MarketPriceOption[] {
  return snapshotToOptions(item.catalog);
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

export function resolveItemMarketSelection(
  item: UserItemWithCatalog,
  preference: MarketPricePreference = 'amazon',
  selectedSource?: string | null,
): { price: number | null; source: MarketPriceSource | null; optionId: string | null } {
  const options = getMarketPriceOptions(item);
  if (!options.length) {
    if (item.price > 0) return { price: item.price, source: 'manual', optionId: 'manual' };
    return { price: null, source: null, optionId: null };
  }

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

export function resolveItemMarketPrice(
  item: UserItemWithCatalog,
  preference: MarketPricePreference = 'amazon',
  selectedSource?: string | null,
): number | null {
  return resolveItemMarketSelection(item, preference, selectedSource).price;
}

export function resolveInitialSelectedSource(
  item: UserItemWithCatalog,
  preference: MarketPricePreference,
): string | undefined;
export function resolveInitialSelectedSource(
  product: Product | null | undefined,
  preference: MarketPricePreference,
): string | undefined;
export function resolveInitialSelectedSource(
  input: UserItemWithCatalog | Product | null | undefined,
  preference: MarketPricePreference,
): string | undefined {
  const options =
    input && 'catalog' in input
      ? getMarketPriceOptions(input)
      : productSnapshotToOptions(input as Product | null | undefined);
  if (!options.length) return undefined;
  if (preference === 'show_all') {
    return getMarketPriceOptionId(options[0]!);
  }
  const preferred = findOptionForPreference(options, preference);
  if (preferred) return getMarketPriceOptionId(preferred);
  return getMarketPriceOptionId(options[0]!);
}

export function shouldShowMarketPricePicker(
  item: UserItemWithCatalog,
  preference: MarketPricePreference,
): boolean {
  const options = getMarketPriceOptions(item);
  if (options.length <= 1) return false;
  return preference === 'show_all';
}

export function hasMultipleMarketPriceOptions(item: UserItemWithCatalog): boolean {
  return getMarketPriceOptions(item).length > 1;
}

function productSnapshotToOptions(product: Product | null | undefined): MarketPriceOption[] {
  if (!product) return [];
  if (product.marketPriceOptions?.length) return product.marketPriceOptions;
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

/** Resolve market price during entry review (Product-based, pre-save). */
export function resolveProductMarketSelection(
  product: Product | null | undefined,
  preference: MarketPricePreference = 'amazon',
  selectedSource?: string | null,
): { price: number | null; source: MarketPriceSource | null; optionId: string | null } {
  const options = productSnapshotToOptions(product);
  if (!options.length) return { price: null, source: null, optionId: null };

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

export function resolveProductMarketPrice(
  product: Product | null | undefined,
  preference: MarketPricePreference = 'amazon',
  selectedSource?: string | null,
): number | null {
  return resolveProductMarketSelection(product, preference, selectedSource).price;
}

export function getProductMarketPriceOptions(product: Product | null | undefined): MarketPriceOption[] {
  return productSnapshotToOptions(product);
}

export function shouldShowProductMarketPricePicker(
  product: Product | null | undefined,
  preference: MarketPricePreference,
): boolean {
  const options = productSnapshotToOptions(product);
  if (options.length <= 1) return false;
  return preference === 'show_all';
}

export { isUpcMarketSource };
