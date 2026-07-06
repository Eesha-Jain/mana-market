import type { Product, EbayCondition, PricingMode, ImageCandidate, MarketPricePreference, MarketPriceSource } from '../types';
import type { EntryReviewDraft } from './entryReview';
import { entryDraftPricingDefaults } from './entryReview';
import type { PackParseResult } from './photoScanner';
import { searchProduct } from './productApi';
import { resolveSearchParams } from './productLookup';

export interface ProductReviewData {
  variant: 'photo' | 'entry';
  searchQuery: string;
  originalUpc?: string;
  originalSku?: string;
  /** Spreadsheet import text merged into the initial description */
  importNotes?: string;
  photoUrl?: string;
  ocrText?: string;
  readableLines: string[];
  parseResult?: PackParseResult | null;
  matchedProduct: Product | null;
  suggestedProduct?: Product | null;
  imageCandidates?: ImageCandidate[] | null;
  missingImage?: boolean;
  /** When set, user must pick a product before the review dialog opens. */
  ambiguousResults: Product[] | null;
  lookupError?: string;
  scanError?: string;
  initialQuantity: number;
  initialCondition: EbayCondition | null;
  initialPricingMode: PricingMode;
  initialPercentBelow: number;
  initialManualPrice: number;
  source: 'manual' | 'csv' | 'photo';
}

export interface ProductReviewConfirmPayload {
  query: string;
  source: 'manual' | 'csv' | 'photo';
  customTitle?: string;
  customDescription?: string;
  originalUpc?: string;
  originalSku?: string;
  quantity: number;
  condition: EbayCondition | null;
  pricingMode: PricingMode;
  percentBelow: number;
  manualPrice: number;
  marketPricePreference?: MarketPricePreference;
  selectedMarketPriceSource?: MarketPriceSource;
  product?: Product;
  photoUrl?: string;
  userImageUrl?: string;
  preferredImageSource?: 'catalog' | 'user';
  selectedImageUrl?: string;
  parseMeta?: {
    packType?: string;
    cardCount?: string;
  };
}

/** Build initial description from UPC, SKU, and optional import text. */
export function buildInitialDescription(
  originalUpc?: string,
  originalSku?: string,
  importNotes?: string,
): string {
  const parts: string[] = [];
  if (originalUpc?.trim()) parts.push(`UPC: ${originalUpc.trim()}`);
  if (originalSku?.trim()) parts.push(`SKU: ${originalSku.trim()}`);
  if (importNotes?.trim()) parts.push(importNotes.trim());
  return parts.join('\n\n');
}

/** Hero image for the review dialog — respects explicit user/catalog preference. */
export function getReviewHeroImage(
  data: ProductReviewData,
  product: Product | null,
  selection?: { selectedUrl?: string | null; preferredImageSource?: 'catalog' | 'user'; userImageUrl?: string },
): string | null {
  if (selection?.selectedUrl) return selection.selectedUrl;
  if (selection?.preferredImageSource === 'user') {
    return selection.userImageUrl ?? data.photoUrl ?? null;
  }
  if (data.photoUrl && data.variant === 'photo') return data.photoUrl;
  return product?.imageUrls[0] ?? data.photoUrl ?? null;
}

export function collectReviewImageCandidates(
  data: ProductReviewData,
  product: Product | null,
  userImageUrl?: string,
): ImageCandidate[] {
  const seen = new Set<string>();
  const out: ImageCandidate[] = [];

  const push = (url: string | undefined, source: ImageCandidate['source']) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ url, source });
  };

  for (const candidate of data.imageCandidates ?? product?.imageCandidates ?? []) {
    push(candidate.url, candidate.source);
  }
  for (const url of product?.imageUrls ?? []) {
    push(url, 'ebay_sold');
  }
  push(userImageUrl, 'user_upload');
  push(data.photoUrl, 'user_photo');

  return out;
}

export function needsProductDisambiguation(data: ProductReviewData): boolean {
  return !!data.ambiguousResults?.length && !data.matchedProduct;
}

export async function lookupProductForReview(
  query: string,
  identifiers: { originalUpc?: string; originalSku?: string } = {},
): Promise<{
  matchedProduct: Product | null;
  ambiguousResults: Product[] | null;
  lookupError: string;
  imageCandidates: ImageCandidate[] | null;
  missingImage: boolean;
}> {
  const { originalUpc, originalSku } = identifiers;
  const { query: searchQuery, upc, sku } = resolveSearchParams(query, {
    originalUpc,
    originalSku,
  });

  const result = await searchProduct(searchQuery, upc, sku).catch(
    () => ({ type: 'unavailable' as const, reason: 'network error' }),
  );

  if (result.type === 'found') {
    return {
      matchedProduct: result.product,
      ambiguousResults: null,
      lookupError: '',
      imageCandidates: result.imageCandidates ?? result.product.imageCandidates ?? null,
      missingImage: result.missingFields?.includes('image') ?? !result.product.imageUrls.length,
    };
  }

  if (result.type === 'ambiguous') {
    return {
      matchedProduct: null,
      ambiguousResults: result.results,
      lookupError: '',
      imageCandidates: result.imageCandidates ?? null,
      missingImage: result.missingFields?.includes('image') ?? !result.results.some(p => p.imageUrls.length),
    };
  }

  if (result.type === 'not_found') {
    return {
      matchedProduct: null,
      ambiguousResults: null,
      lookupError: 'No online match found. You can still edit details and add the listing manually.',
      imageCandidates: null,
      missingImage: true,
    };
  }

  return {
    matchedProduct: null,
    ambiguousResults: null,
    lookupError: 'Product lookup is unavailable. You can still edit details and add the listing manually.',
    imageCandidates: null,
    missingImage: true,
  };
}

export async function buildEntryProductReviewData(
  draft: EntryReviewDraft,
): Promise<ProductReviewData> {
  const {
    matchedProduct,
    ambiguousResults,
    lookupError,
    imageCandidates,
    missingImage,
  } = await lookupProductForReview(
    draft.query,
    { originalUpc: draft.originalUpc, originalSku: draft.originalSku },
  );

  return {
    variant: 'entry',
    searchQuery: draft.query,
    originalUpc: draft.originalUpc,
    originalSku: draft.originalSku,
    importNotes: draft.description || undefined,
    readableLines: [],
    matchedProduct,
    suggestedProduct: matchedProduct,
    ambiguousResults,
    imageCandidates,
    missingImage,
    lookupError,
    initialQuantity: draft.quantity,
    initialCondition: draft.condition,
    ...entryDraftPricingDefaults(draft),
    source: draft.source,
  };
}

export function withSelectedProduct(
  data: ProductReviewData,
  product: Product,
): ProductReviewData {
  return {
    ...data,
    matchedProduct: product,
    suggestedProduct: product,
    ambiguousResults: null,
    imageCandidates: product.imageCandidates ?? data.imageCandidates,
    missingImage: !product.imageUrls.length,
    lookupError: data.lookupError && !product ? data.lookupError : '',
  };
}
