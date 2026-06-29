import { test, expect } from '@playwright/test';
import {
  calculatePrice,
  exportListingsJSON,
  getExportableItems,
  getItemMarketPrice,
  isItemOnEbay,
  isItemReady,
  buildEbayListing,
} from '../src/utils/ebayMapper';
import { makeReadyItem, MOCK_BOOSTER_BOX } from './helpers/sampleData';

test.describe('ebayMapper pricing', () => {
  test('uses market price in market mode', () => {
    const item = makeReadyItem({ pricingMode: 'market' });
    expect(calculatePrice(item)).toBe(289.99);
    expect(getItemMarketPrice(item)).toBe(289.99);
  });

  test('applies percent below discount', () => {
    const item = makeReadyItem({ pricingMode: 'percent_below', percentBelow: 10 });
    expect(calculatePrice(item)).toBe(260.99);
  });

  test('uses manual price in manual mode', () => {
    const item = makeReadyItem({ pricingMode: 'manual', manualPrice: 199.99 });
    expect(calculatePrice(item)).toBe(199.99);
  });

  test('manual price of zero returns null', () => {
    const item = makeReadyItem({ pricingMode: 'manual', manualPrice: 0 });
    expect(calculatePrice(item)).toBeNull();
  });
});

test.describe('ebayMapper readiness and export', () => {
  test('isItemReady requires found status, product, condition, and price', () => {
    expect(isItemReady(makeReadyItem())).toBe(true);
    expect(isItemReady(makeReadyItem({ condition: null }))).toBe(false);
    expect(isItemReady(makeReadyItem({ status: 'searching' }))).toBe(false);
    expect(isItemReady(makeReadyItem({ product: undefined }))).toBe(false);
  });

  test('isItemOnEbay checks export timestamp', () => {
    expect(isItemOnEbay(makeReadyItem())).toBe(false);
    expect(isItemOnEbay(makeReadyItem({ ebayExportedAt: new Date().toISOString() }))).toBe(true);
  });

  test('getExportableItems excludes unready and already exported', () => {
    const items = [
      makeReadyItem({ id: '1' }),
      makeReadyItem({ id: '2', condition: null }),
      makeReadyItem({ id: '3', ebayExportedAt: new Date().toISOString() }),
    ];
    expect(getExportableItems(items)).toHaveLength(1);
    expect(getExportableItems(items)[0]!.id).toBe('1');
  });

  test('buildEbayListing produces valid payload', () => {
    const item = makeReadyItem({ notes: 'Factory sealed.' });
    const payload = buildEbayListing(item);
    expect(payload).not.toBeNull();
    expect(payload!.startPrice).toBe(289.99);
    expect(payload!.quantity).toBe(1);
    expect(payload!.conditionId).toBe(2750);
    expect(payload!.itemSpecifics['Game']).toBe('Magic: The Gathering');
    expect(payload!.itemSpecifics['Type']).toBe('Booster Box');
    expect(payload!.pictureUrls).toEqual(MOCK_BOOSTER_BOX.imageUrls);
    expect(payload!.description).toContain('Factory sealed.');
  });

  test('buildEbayListing uses booster category for set booster titles', () => {
    const item = makeReadyItem({
      product: { ...MOCK_BOOSTER_BOX, title: 'Edge of Eternities Set Booster Pack' },
      customTitle: 'Edge of Eternities Set Booster Pack',
    });
    expect(buildEbayListing(item)!.primaryCategory.categoryId).toBe('183451');
  });

  test('exportListingsJSON returns JSON array of ready listings', () => {
    const json = exportListingsJSON([
      makeReadyItem({ id: '1' }),
      makeReadyItem({ id: '2', status: 'not_found', product: undefined, condition: null }),
    ]);
    const parsed = JSON.parse(json) as unknown[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ startPrice: 289.99, listingType: 'FixedPriceItem' });
  });
});
