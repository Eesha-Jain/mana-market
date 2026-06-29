import type { Page } from '@playwright/test';
import type { Product } from '../../src/types';
import { MOCK_AMBIGUOUS_PRODUCTS, MOCK_BOOSTER_BOX, MOCK_NOT_FOUND_QUERY } from './sampleData';

type SearchHandler = (query: string, upc?: string, sku?: string) => object;

export async function mockSearchApi(page: Page, handler?: SearchHandler) {
  await page.route('**/api/search**', async route => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q') ?? '';
    const upc = url.searchParams.get('upc') ?? undefined;
    const sku = url.searchParams.get('sku') ?? undefined;

    const result = handler
      ? handler(query, upc, sku)
      : defaultSearchHandler(query, upc, sku);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(result),
    });
  });
}

function defaultSearchHandler(query: string, upc?: string, sku?: string): object {
  if (query.toLowerCase().includes('ambiguous')) {
    return { type: 'ambiguous', source: 'test', results: MOCK_AMBIGUOUS_PRODUCTS };
  }
  if (query.toLowerCase().includes('not found') || query === MOCK_NOT_FOUND_QUERY) {
    return { type: 'not_found' };
  }
  if (upc === '000000000000') {
    return { type: 'not_found' };
  }

  return {
    type: 'found',
    source: 'test',
    product: {
      ...MOCK_BOOSTER_BOX,
      title: query || sku || upc || MOCK_BOOSTER_BOX.title,
    },
  };
}

export async function mockHealthApi(page: Page, ebayConfigured = false) {
  await page.route('**/api/health**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        ebayConfigured,
        supabaseConfigured: false,
        version: '1.0.0',
      }),
    });
  });
}

export function foundProductResponse(product: Product) {
  return { type: 'found', source: 'test', product };
}
