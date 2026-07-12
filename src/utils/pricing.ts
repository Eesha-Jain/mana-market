import type { PricingCalculationInput } from '../types';

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
