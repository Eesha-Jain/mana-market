import { normalizeCondition } from './csvParser';
import { normalizeProductLookup, parseManualLookupInput } from './productLookup';
import type { EbayCondition, PricingMode } from '../types';

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
