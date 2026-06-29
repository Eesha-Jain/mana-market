import { test, expect } from '@playwright/test';
import {
  isBarcode,
  parseManualLookupInput,
  parseBulkLine,
  getLookupFromRow,
  normalizeProductLookup,
  resolveSearchParams,
} from '../src/utils/productLookup';

test.describe('productLookup', () => {
  test('isBarcode recognizes UPC lengths including 10-digit codes', () => {
    expect(isBarcode('5356982362')).toBe(true);
    expect(isBarcode('630509777771')).toBe(true);
    expect(isBarcode('12345678901234')).toBe(true);
    expect(isBarcode('1234567')).toBe(false);
    expect(isBarcode('abc123')).toBe(false);
    expect(isBarcode('MH3/123')).toBe(false);
  });

  test('parseManualLookupInput treats bare numeric input as UPC', () => {
    expect(parseManualLookupInput('5356982362')).toEqual({
      query: '5356982362',
      originalUpc: '5356982362',
    });
  });

  test('parseManualLookupInput leaves product names unchanged', () => {
    expect(parseManualLookupInput('Modern Horizons 3 Booster Box')).toEqual({
      query: 'Modern Horizons 3 Booster Box',
    });
  });

  test('parseManualLookupInput parses comma-separated name and UPC', () => {
    expect(parseManualLookupInput('Modern Horizons 3 Booster Box, 630509777771')).toEqual({
      query: 'Modern Horizons 3 Booster Box',
      originalUpc: '630509777771',
    });
  });

  test('parseManualLookupInput parses comma-separated name and SKU', () => {
    expect(parseManualLookupInput('MH3 Booster Box, WOC-12345')).toEqual({
      query: 'MH3 Booster Box',
      originalSku: 'WOC-12345',
    });
  });

  test('parseManualLookupInput parses tab-separated name and UPC', () => {
    expect(parseManualLookupInput('MH3 Booster Box\t630509777771')).toEqual({
      query: 'MH3 Booster Box',
      originalUpc: '630509777771',
    });
  });

  test('parseBulkLine uses the same rules as manual entry', () => {
    expect(parseBulkLine('630509777771')).toEqual(parseManualLookupInput('630509777771'));
    expect(parseBulkLine('MH3 Box, WOC-999')).toEqual(parseManualLookupInput('MH3 Box, WOC-999'));
  });

  test('getLookupFromRow keeps separate UPC and SKU columns', () => {
    expect(getLookupFromRow({
      name: 'MH3 Booster Box',
      upc: '630509777771',
      sku: 'WOC-12345',
    })).toEqual({
      query: 'MH3 Booster Box',
      originalUpc: '630509777771',
      originalSku: 'WOC-12345',
    });
  });

  test('getLookupFromRow treats barcode-only sku column as UPC', () => {
    expect(getLookupFromRow({ sku: '5356982362' })).toEqual({
      query: '5356982362',
      originalUpc: '5356982362',
    });
  });

  test('getLookupFromRow uses non-barcode sku when name missing', () => {
    expect(getLookupFromRow({ sku: 'MH3/123' })).toEqual({
      query: 'MH3/123',
      originalSku: 'MH3/123',
    });
  });

  test('resolveSearchParams sends only upc for UPC-only input', () => {
    expect(resolveSearchParams('5356982362')).toEqual({
      query: '',
      upc: '5356982362',
    });
  });

  test('resolveSearchParams sends upc and fallback title when both present', () => {
    expect(resolveSearchParams('MH3 Booster Box', { originalUpc: '630509777771' })).toEqual({
      query: 'MH3 Booster Box',
      upc: '630509777771',
    });
  });

  test('resolveSearchParams sends sku for SKU-only input', () => {
    expect(resolveSearchParams('WOC-12345', { originalSku: 'WOC-12345' })).toEqual({
      query: '',
      sku: 'WOC-12345',
    });
  });

  test('resolveSearchParams sends sku with fallback title when both present', () => {
    expect(resolveSearchParams('MH3 Booster Box', { originalSku: 'WOC-12345' })).toEqual({
      query: 'MH3 Booster Box',
      sku: 'WOC-12345',
    });
  });

  test('normalizeProductLookup keeps sku and upc separate', () => {
    expect(normalizeProductLookup('Lightning Bolt', { originalSku: 'MH3/123' })).toEqual({
      query: 'Lightning Bolt',
      originalSku: 'MH3/123',
    });
  });
});
