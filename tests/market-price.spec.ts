import { test, expect } from '@playwright/test';
import type { Product } from '../src/types';
import {
  getMarketPriceOptions,
  resolveProductMarketPrice,
  shouldShowMarketPricePicker,
} from '../src/utils/marketPrice';

const sampleProduct: Product = {
  title: 'Test Box',
  description: '',
  imageUrls: [],
  marketPriceOptions: [
    { source: 'ebay_completed', price: 120, soldCount: 8 },
    { source: 'upc_offers', price: 99.99 },
  ],
};

test.describe('marketPrice', () => {
  test('prefers eBay when preference is ebay', () => {
    expect(resolveProductMarketPrice(sampleProduct, 'ebay')).toBe(120);
  });

  test('prefers UPC when preference is upc', () => {
    expect(resolveProductMarketPrice(sampleProduct, 'upc')).toBe(99.99);
  });

  test('show_all uses selected source', () => {
    expect(resolveProductMarketPrice(sampleProduct, 'show_all', 'upc_offers')).toBe(99.99);
  });

  test('show_all picker appears when multiple options exist', () => {
    expect(shouldShowMarketPricePicker(sampleProduct, 'show_all')).toBe(true);
    expect(shouldShowMarketPricePicker(sampleProduct, 'ebay')).toBe(false);
  });

  test('falls back to legacy single-price products', () => {
    const legacy: Product = {
      title: 'Legacy',
      description: '',
      imageUrls: [],
      marketPrice: 55,
      marketPriceSource: 'upc_recorded',
    };
    expect(getMarketPriceOptions(legacy)).toHaveLength(1);
    expect(resolveProductMarketPrice(legacy, 'upc')).toBe(55);
  });
});
