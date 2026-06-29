import { test, expect } from '@playwright/test';
import { parsePackFromOcr } from '../src/utils/photoScanner';

/** Representative OCR blobs captured from fixture labels (see tests/fixtures/). */
const FIXTURE_OCR = {
  lotrSetBooster: `
THE LORD OF THE RINGS
TALES OF MIDDLE-EARTH
SET BOOSTER
12 CARDS
MAGIC THE GATHERING
UNIVERSES BEYOND
`.trim(),

  edgePromoPack: `
EDGE OF ETERNITIES
PROMO PACK
3 CARDS
MAGIC THE GATHERING
`.trim(),

  duskmournFoilPromo: `
DUSKMOURN
HOUSE OF HORROR
FOIL PROMO PACK
3 CARDS
MAGIC THE GATHERING
`.trim(),
};

test.describe('photo fixture OCR parsing', () => {
  test('LOTR set booster fixture text', () => {
    const result = parsePackFromOcr(FIXTURE_OCR.lotrSetBooster);
    expect(result!.setName).toBe('The Lord of the Rings Tales of Middle-earth');
    expect(result!.packType).toBe('Set Booster Pack');
    expect(result!.fullTitle).toContain('Set Booster');
    expect(result!.fullTitle).not.toMatch(/Duskmourn/i);
  });

  test('Edge of Eternities promo pack fixture text', () => {
    const result = parsePackFromOcr(FIXTURE_OCR.edgePromoPack);
    expect(result!.setName).toBe('Edge of Eternities');
    expect(result!.packType).toBe('Promo Pack');
    expect(result!.confidence).toBe('high');
  });

  test('Duskmourn foil promo fixture text only matches when clearly present', () => {
    const result = parsePackFromOcr(FIXTURE_OCR.duskmournFoilPromo);
    expect(result!.setName).toBe('Duskmourn House of Horror');
    expect(result!.packType).toBe('Foil Promo Pack');
    expect(result!.fullTitle).toBe('Duskmourn House of Horror Foil Promo Pack');
  });
});

test.describe('listing id helpers', () => {
  test('generateListingId format', async () => {
    const { generateListingId } = await import('../src/types');
    expect(generateListingId()).toMatch(/^MTG-[23456789A-HJ-NP-Z]{6}$/);
  });

  test('getItemTitle prefers customTitle', async () => {
    const { getItemTitle, getDetectedTitle } = await import('../src/types');
    const item = {
      query: 'fallback query',
      customTitle: 'Custom Listing Title',
      product: { title: 'Detected Product', description: '', imageUrls: [] },
    } as import('../src/types').ItemListing;

    expect(getItemTitle(item)).toBe('Custom Listing Title');
    expect(getDetectedTitle(item)).toBe('Detected Product');
  });
});

test.describe('textCase multi-line', () => {
  test('sentence case preserves line breaks', async () => {
    const { applyTextCase } = await import('../src/utils/textCase');
    expect(applyTextCase('LINE ONE\nLINE TWO', 'sentence')).toBe('Line one\nLine two');
  });
});
