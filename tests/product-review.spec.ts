import { test, expect } from '@playwright/test';
import {
  buildInitialSellerNotes,
  needsProductDisambiguation,
  withSelectedProduct,
} from '../src/utils/productReview';
import { MOCK_AMBIGUOUS_PRODUCTS } from './helpers/sampleData';

test.describe('productReview', () => {
  test('buildInitialSellerNotes includes UPC, SKU, and import notes', () => {
    expect(buildInitialSellerNotes('5356982362')).toBe('UPC: 5356982362');
    expect(buildInitialSellerNotes(undefined, 'WOC-12345')).toBe('SKU: WOC-12345');
    expect(buildInitialSellerNotes('5356982362', 'WOC-12345')).toBe(
      'UPC: 5356982362\n\nSKU: WOC-12345',
    );
    expect(buildInitialSellerNotes('5356982362', undefined, 'Handle with care')).toBe(
      'UPC: 5356982362\n\nHandle with care',
    );
  });

  test('needsProductDisambiguation when ambiguous and no match', () => {
    expect(
      needsProductDisambiguation({
        variant: 'entry',
        searchQuery: 'test',
        readableLines: [],
        matchedProduct: null,
        ambiguousResults: MOCK_AMBIGUOUS_PRODUCTS,
        initialQuantity: 1,
        initialCondition: null,
        initialPricingMode: 'market',
        initialPercentBelow: 10,
        initialManualPrice: 0,
        source: 'manual',
      }),
    ).toBe(true);
  });

  test('withSelectedProduct clears ambiguous results', () => {
    const data = {
      variant: 'entry' as const,
      searchQuery: 'test',
      readableLines: [],
      matchedProduct: null,
      ambiguousResults: MOCK_AMBIGUOUS_PRODUCTS,
      initialQuantity: 1,
      initialCondition: null,
      initialPricingMode: 'market' as const,
      initialPercentBelow: 10,
      initialManualPrice: 0,
      source: 'manual' as const,
    };
    const resolved = withSelectedProduct(data, MOCK_AMBIGUOUS_PRODUCTS[0]!);
    expect(resolved.matchedProduct).toEqual(MOCK_AMBIGUOUS_PRODUCTS[0]);
    expect(resolved.ambiguousResults).toBeNull();
  });
});
