import type { ItemListing, Product } from '../../src/types';

export const MOCK_BOOSTER_BOX: Product = {
  title: 'Modern Horizons 3 Booster Box',
  description: '36 Modern Horizons 3 draft boosters.',
  imageUrls: ['https://example.com/mh3-box.jpg'],
  brand: 'Wizards of the Coast',
  upc: '630509777771',
  marketPrice: 289.99,
  marketPriceSource: 'ebay_completed',
  priceRange: { low: 250, high: 320 },
  ebaySearchUrl: 'https://www.ebay.com/sch/i.html?_nkw=Modern+Horizons+3+Booster+Box',
  tcgplayerUrl: 'https://www.tcgplayer.com/search/magic/product?q=Modern+Horizons+3+Booster+Box',
};

export const MOCK_AMBIGUOUS_PRODUCTS: Product[] = [
  {
    title: 'Murders at Karlov Manor Commander Deck - Deadly Disguise',
    description: 'Preconstructed commander deck.',
    imageUrls: ['https://example.com/karlov-1.jpg'],
    brand: 'Wizards of the Coast',
    marketPrice: 44.99,
  },
  {
    title: 'Murders at Karlov Manor Commander Deck - Blame Game',
    description: 'Preconstructed commander deck.',
    imageUrls: ['https://example.com/karlov-2.jpg'],
    brand: 'Wizards of the Coast',
    marketPrice: 42.5,
  },
];

export const MOCK_NOT_FOUND_QUERY = 'Totally Unknown Sealed Product XYZ';

export function makeReadyItem(overrides: Partial<ItemListing> = {}): ItemListing {
  return {
    id: 'item-1',
    listingId: 'MTG-TEST01',
    query: MOCK_BOOSTER_BOX.title,
    status: 'found',
    product: MOCK_BOOSTER_BOX,
    quantity: 1,
    condition: 'Like New',
    pricingMode: 'market',
    percentBelow: 10,
    manualPrice: 0,
    notes: '',
    source: 'manual',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export const SAMPLE_CSV_TSV = [
  'Name\tSKU\tQuantity\tCondition',
  'Modern Horizons 3 Booster Box\t630509777771\t2\tNM',
  'Commander Masters Bundle\t\t1\tLP',
].join('\n');

export const SAMPLE_CSV_COMMA = [
  'Name,SKU,Quantity,Condition',
  '"Modern Horizons 3 Booster Box",630509777771,1,New',
  'Totally Unknown Sealed Product XYZ,,1,',
].join('\n');
