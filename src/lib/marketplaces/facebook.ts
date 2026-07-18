import type { MarketplaceAdapter, ListItemInput } from './types';
import type { MarketplaceListing } from '@/types';

/** Hybrid Facebook adapter — guided listing with manual URL confirmation. */
export const facebookAdapter: MarketplaceAdapter = {
  platform: 'facebook',

  async listItem(input: ListItemInput, accessToken: string): Promise<MarketplaceListing> {
    void accessToken;
    const params = new URLSearchParams({
      title: input.title,
      price: String(input.price),
      quantity: String(input.quantity),
    });
    const now = new Date().toISOString();
    return {
      listingId: `fb-pending-${input.referenceId}`,
      url: `https://www.facebook.com/marketplace/create/item?${params}`,
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
