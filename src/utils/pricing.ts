import type { PricingMode } from '../types';

export interface DraftPricingInput {
  pricingMode: PricingMode;
  percentBelow: number;
  manualPrice: number;
}

/** Compute listing price from market data and pricing preferences (draft or saved item). */
export function calculateDraftPrice(
  marketPrice: number | null,
  pricing: DraftPricingInput,
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
