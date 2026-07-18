import type { MarketplaceAdapter, ListItemInput } from './types';
import type { MarketplaceListing } from '@/types';
import { createEbayListing, endEbayListing, syncEbayListing } from './ebay/api';
import type { EbaySellerDefaults } from './ebay/oauth';

export const ebayAdapter: MarketplaceAdapter = {
  platform: 'ebay',

  async listItem(input: ListItemInput, accessToken: string): Promise<MarketplaceListing> {
    const sellerDefaults = parseSellerDefaults(accessToken);
    return createEbayListing(input, sellerDefaults.token, sellerDefaults.defaults);
  },

  async syncListing(listing: MarketplaceListing, accessToken: string): Promise<MarketplaceListing> {
    const { token } = parseSellerDefaults(accessToken);
    return syncEbayListing(listing, token);
  },

  async endListing(listing: MarketplaceListing, accessToken: string): Promise<MarketplaceListing> {
    const { token } = parseSellerDefaults(accessToken);
    return endEbayListing(listing, token);
  },
};

function parseSellerDefaults(accessToken: string): {
  token: string;
  defaults: EbaySellerDefaults;
} {
  const separator = accessToken.indexOf('::');
  if (separator === -1) {
    return { token: accessToken, defaults: {} };
  }

  const token = accessToken.slice(0, separator);
  try {
    const defaults = JSON.parse(accessToken.slice(separator + 2)) as EbaySellerDefaults;
    return { token, defaults };
  } catch {
    return { token, defaults: {} };
  }
}

export function encodeEbayAdapterToken(
  accessToken: string,
  defaults: EbaySellerDefaults,
): string {
  return `${accessToken}::${JSON.stringify(defaults)}`;
}
