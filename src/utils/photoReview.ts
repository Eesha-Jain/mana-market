import {
  scanPhotoForProduct,
  OcrError,
  composeQueryFromLines,
  suggestInitialLineSelection,
} from './photoScanner';
import { extractUpcFromImage } from './geminiOcr';
import { isBarcode } from './productLookup';
import { lookupProductForReview, type ProductReviewData } from './productReview';
import type { PhotoCaptureTarget } from './userSettings';

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
