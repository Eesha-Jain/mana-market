import { test, expect } from '@playwright/test';
import { searchItem } from '../server/search';
import { getItemImageUrl, getItemPictureUrls, itemHasListingImage } from '../src/types';
import { makeReadyItem, MOCK_BOOSTER_BOX } from './helpers/sampleData';

test.describe('search enrichment', () => {
  test('manual fallback reports missing image metadata', async () => {
    const result = await searchItem('Totally Unknown Product XYZ', undefined, undefined);
    // Live UPC/eBay APIs may return found-without-image or not_found for unknown titles.
    expect(['found', 'not_found']).toContain(result.type);
    expect(result.missingFields ?? []).toContain('image');
    if (result.type === 'found') {
      expect(result.product?.imageUrls).toEqual([]);
    }
  });
});

const USER_IMAGE_URL = 'https://example.com/listing-images/custom.jpg';

test.describe('listing image helpers', () => {
  test('getItemImageUrl prefers user image when selected', () => {
    const item = makeReadyItem({
      userImageUrl: USER_IMAGE_URL,
      preferredImageSource: 'user',
    });
    expect(getItemImageUrl(item)).toBe(USER_IMAGE_URL);
  });

  test('getItemPictureUrls puts selected image first', () => {
    const item = makeReadyItem({
      userImageUrl: USER_IMAGE_URL,
      preferredImageSource: 'user',
      product: {
        ...MOCK_BOOSTER_BOX,
        imageUrls: ['https://example.com/catalog.jpg', 'https://example.com/alt.jpg'],
      },
    });

    expect(getItemPictureUrls(item)[0]).toBe(USER_IMAGE_URL);
    expect(getItemPictureUrls(item)).toContain('https://example.com/catalog.jpg');
  });

  test('itemHasListingImage detects catalog and user images', () => {
    expect(itemHasListingImage(makeReadyItem())).toBe(true);
    expect(itemHasListingImage(makeReadyItem({ product: { ...MOCK_BOOSTER_BOX, imageUrls: [] } }))).toBe(false);
    expect(itemHasListingImage(makeReadyItem({
      product: { ...MOCK_BOOSTER_BOX, imageUrls: [] },
      userImageUrl: 'https://example.com/x.jpg',
    }))).toBe(true);
  });
});
