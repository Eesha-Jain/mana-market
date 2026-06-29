import { test, expect } from '@playwright/test';
import { inferProductTypeFromText, resolveItemProductType } from '../src/utils/productType';
import { makeReadyItem } from './helpers/sampleData';

test.describe('product type inference', () => {
  test('detects foil promo pack from title', () => {
    expect(inferProductTypeFromText('Duskmourn House of Horror Foil Promo Pack')).toBe('Foil Promo Pack');
  });

  test('detects commander deck from title', () => {
    expect(inferProductTypeFromText('Murders at Karlov Manor Commander Deck')).toBe('Commander Deck');
  });

  test('detects booster box', () => {
    expect(inferProductTypeFromText('Bloomburrow Booster Box')).toBe('Booster Box');
  });

  test('detects set booster pack', () => {
    expect(inferProductTypeFromText('The Lord of the Rings Set Booster')).toBe('Set Booster Pack');
  });

  test('detects collector booster display before collector booster pack', () => {
    expect(inferProductTypeFromText('Modern Horizons 3 Collector Booster Display')).toBe(
      'Collector Booster Display',
    );
  });

  test('detects draft/play booster', () => {
    expect(inferProductTypeFromText('Bloomburrow Play Booster Pack')).toBe('Draft Booster Pack');
  });

  test('detects bundle and gift bundle', () => {
    expect(inferProductTypeFromText('Duskmourn Bundle')).toBe('Bundle');
    expect(inferProductTypeFromText('Edge of Eternities Gift Bundle')).toBe('Gift Bundle');
  });

  test('fuzzy commander OCR', () => {
    expect(inferProductTypeFromText('COMMNDR DECK - precon')).toBe('Commander Deck');
    expect(inferProductTypeFromText('CMDR DECK Azorius')).toBe('Commander Deck');
  });

  test('returns null when no product type detected', () => {
    expect(inferProductTypeFromText('Random Magic Product')).toBeNull();
  });

  test('resolveItemProductType prefers detectedProductType metadata', () => {
    const item = makeReadyItem({
      detectedProductType: 'Foil Promo Pack',
      customTitle: 'Some Random Title',
    });
    expect(resolveItemProductType(item)).toBe('Foil Promo Pack');
  });

  test('resolveItemProductType falls back to title inference', () => {
    const item = makeReadyItem({
      customTitle: 'Modern Horizons 3 Booster Box',
      detectedProductType: undefined,
    });
    expect(resolveItemProductType(item)).toBe('Booster Box');
  });
});
