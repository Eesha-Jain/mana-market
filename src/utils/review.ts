import type {
  Product,
  ImageCandidate,
  ItemSource,
  PreferredImageSource,
  ListingCreatePayload,
  ReviewListingDefaults,
  EbayCondition,
  PricingMode,
} from '../types';
import { searchProduct, resolveSearchParams, isBarcode } from './search';
import { normalizeCondition } from './csv';
import { normalizeProductLookup, parseManualLookupInput } from './search';
import {
  scanPhotoForProduct,
  OcrError,
  composeQueryFromLines,
  suggestInitialLineSelection,
} from './ocr';
import { extractUpcFromImage } from './ocr';
import type { PhotoCaptureTarget } from './settings';
import type { PackParseResult } from './ocr';


export interface EntryReviewDraft {
  query: string;
  source: 'manual' | 'csv';
  originalUpc?: string;
  originalSku?: string;
  quantity: number;
  condition: EbayCondition | null;
  description: string;
  /** Imported CSV price — review modal applies user pricing defaults. */
  manualPrice: number;
}

export interface ManualEntryInput {
  query: string;
  source?: 'manual' | 'csv';
  originalUpc?: string;
  originalSku?: string;
  quantity?: number;
  condition?: string;
  notes?: string;
  price?: string;
}

export function buildEntryDraft(input: ManualEntryInput): EntryReviewDraft {
  const price = input.price?.trim();
  const parsedPrice = price ? parseFloat(price.replace(/[$,]/g, '')) : 0;
  const hasManualPrice = Number.isFinite(parsedPrice) && parsedPrice > 0;

  const lookup =
    input.originalUpc !== undefined || input.originalSku !== undefined
      ? normalizeProductLookup(input.query, {
          originalUpc: input.originalUpc,
          originalSku: input.originalSku,
        })
      : parseManualLookupInput(input.query);

  return {
    query: lookup.query,
    source: input.source ?? 'manual',
    originalUpc: lookup.originalUpc,
    originalSku: lookup.originalSku,
    quantity: input.quantity && input.quantity > 0 ? input.quantity : 1,
    condition: input.condition ? normalizeCondition(input.condition) : null,
    description: input.notes?.trim() ?? '',
    manualPrice: hasManualPrice ? parsedPrice : 0,
  };
}

/** Pricing fields for the review modal — honors user defaults and CSV import price. */
export function entryDraftPricingDefaults(draft: EntryReviewDraft): {
  initialPricingMode: PricingMode;
  initialPercentBelow: number;
  initialManualPrice: number;
} {
  if (draft.manualPrice > 0) {
    return {
      initialPricingMode: 'manual',
      initialPercentBelow: 10,
      initialManualPrice: draft.manualPrice,
    };
  }
  return {
    initialPricingMode: 'market',
    initialPercentBelow: 10,
    initialManualPrice: 0,
  };
}
// --- product review ---

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
  initialQuantity: ReviewListingDefaults['quantity'];
  initialCondition: ReviewListingDefaults['condition'];
  initialPricingMode: ReviewListingDefaults['pricingMode'];
  initialPercentBelow: ReviewListingDefaults['percentBelow'];
  initialManualPrice: ReviewListingDefaults['price'];
  source: ItemSource;
}

export type ProductReviewConfirmPayload = ListingCreatePayload;

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
  selection?: {
    selectedUrl?: string | null;
    selectedUrls?: string[];
    preferredImageSource?: PreferredImageSource;
    userImageUrl?: string;
  },
): string | null {
  if (selection?.selectedUrls?.[0]) return selection.selectedUrls[0];
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
    push(url, 'amazon_catalog');
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
// --- photo review ---

const REVIEW_DEFAULTS = {
  initialQuantity: 1,
  initialCondition: null,
  initialPricingMode: 'market' as const,
  initialPercentBelow: 10,
  initialManualPrice: 0,
};

export async function buildPhotoReviewData(
  file: File,
  photoUrl: string,
  options: { captureTarget?: PhotoCaptureTarget } = {},
): Promise<ProductReviewData> {
  const captureTarget = options.captureTarget ?? 'label';

  if (captureTarget === 'upc') {
    return buildUpcPhotoReviewData(file, photoUrl);
  }

  return buildLabelPhotoReviewData(file, photoUrl);
}

async function buildUpcPhotoReviewData(file: File, photoUrl: string): Promise<ProductReviewData> {
  try {
    const upcRaw = await extractUpcFromImage(file);
    const upc = isBarcode(upcRaw) ? upcRaw : upcRaw.replace(/\D/g, '');

    if (!isBarcode(upc)) {
      return {
        variant: 'photo',
        searchQuery: upcRaw,
        photoUrl,
        originalUpc: upcRaw,
        readableLines: [],
        matchedProduct: null,
        suggestedProduct: null,
        ambiguousResults: null,
        scanError:
          'Could not read a valid UPC from the photo. Try a clearer shot of the barcode, or switch to front-label mode.',
        ...REVIEW_DEFAULTS,
        source: 'photo',
      };
    }

    const lookup = await lookupProductForReview(upc, { originalUpc: upc });

    let scanError = lookup.lookupError;
    if (!lookup.matchedProduct && !lookup.ambiguousResults?.length && !scanError) {
      scanError = 'No online match found for this UPC. You can still edit details and add the listing manually.';
    }

    return {
      variant: 'photo',
      searchQuery: lookup.matchedProduct?.title ?? upc,
      photoUrl,
      originalUpc: upc,
      readableLines: [],
      matchedProduct: lookup.matchedProduct,
      suggestedProduct: lookup.matchedProduct,
      ambiguousResults: lookup.ambiguousResults,
      imageCandidates: lookup.imageCandidates,
      missingImage: lookup.missingImage,
      lookupError: lookup.lookupError,
      scanError,
      ...REVIEW_DEFAULTS,
      source: 'photo',
    };
  } catch (err) {
    const message = err instanceof OcrError
      ? err.message
      : 'UPC scan failed. Try a clearer barcode photo or switch to front-label mode.';
    return {
      variant: 'photo',
      searchQuery: '',
      photoUrl,
      readableLines: [],
      matchedProduct: null,
      suggestedProduct: null,
      ambiguousResults: null,
      scanError: message,
      ...REVIEW_DEFAULTS,
      source: 'photo',
    };
  }
}

async function buildLabelPhotoReviewData(file: File, photoUrl: string): Promise<ProductReviewData> {
  try {
    const result = await scanPhotoForProduct(file, photoUrl);

    const initialLines = suggestInitialLineSelection(result.readableLines, result.parse);
    const initialQuery =
      result.searchQuery ??
      result.parse?.fullTitle ??
      composeQueryFromLines(initialLines) ??
      result.readableLines[0] ??
      '';

    let scanError = '';
    if (result.matchType === 'no_text') {
      scanError =
        'Could not read text from the photo. Try a clearer shot, or enter details manually in the review dialog.';
    } else if (result.matchType === 'not_found') {
      scanError =
        'No exact online match found. You can still build the listing from the detected label text.';
    }

    return {
      variant: 'photo',
      searchQuery: initialQuery,
      photoUrl,
      ocrText: result.ocrText,
      readableLines: result.readableLines,
      parseResult: result.parse,
      matchedProduct: result.matchType === 'found' ? (result.product ?? null) : null,
      suggestedProduct: result.suggestedProduct ?? null,
      ambiguousResults: result.matchType === 'ambiguous' ? (result.candidates ?? null) : null,
      scanError,
      ...REVIEW_DEFAULTS,
      source: 'photo',
    };
  } catch (err) {
    const message = err instanceof OcrError
      ? err.message
      : 'Photo scan failed. Try a clearer image or enter the product name manually.';
    return {
      variant: 'photo',
      searchQuery: '',
      photoUrl,
      readableLines: [],
      matchedProduct: null,
      suggestedProduct: null,
      ambiguousResults: null,
      scanError: message,
      ...REVIEW_DEFAULTS,
      source: 'photo',
    };
  }
}

export const UPLOAD_TABS = [
  { id: 'single', label: 'Single Entry' },
  { id: 'bulk', label: 'Bulk Names' },
  { id: 'csv', label: 'CSV / Spreadsheet' },
  { id: 'photo', label: 'Photo Scan' },
] as const;

export type UploadTabId = (typeof UPLOAD_TABS)[number]['id'];
