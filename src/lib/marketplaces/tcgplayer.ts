import type { MarketplaceAdapter, ListItemInput } from './types';
import type { MarketplaceListing } from '@/types';

const TCGPLAYER_SELLER_PORTAL = 'https://sellerportal.tcgplayer.com/';
const TCGPLAYER_SEARCH = 'https://www.tcgplayer.com/search/product';

export const tcgplayerAdapter: MarketplaceAdapter = {
  platform: 'tcgplayer',

  async listItem(input: ListItemInput, accessToken: string): Promise<MarketplaceListing> {
    void accessToken;
    const params = new URLSearchParams({ q: input.title });
    const now = new Date().toISOString();
    return {
      listingId: `tcg-pending-${input.referenceId}`,
      url: `${TCGPLAYER_SEARCH}?${params.toString()}`,
      status: 'pending',
      listedAt: now,
      lastSyncedAt: now,
    };
  },

  async syncListing(listing: MarketplaceListing, accessToken: string): Promise<MarketplaceListing> {
    void accessToken;
    return { ...listing, lastSyncedAt: new Date().toISOString() };
  },

  async endListing(listing: MarketplaceListing, accessToken: string): Promise<MarketplaceListing> {
    void accessToken;
    return { ...listing, status: 'ended', lastSyncedAt: new Date().toISOString() };
  },
};

export { TCGPLAYER_SELLER_PORTAL };
