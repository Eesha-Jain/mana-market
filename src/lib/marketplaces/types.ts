import type {
  MarketplaceListing,
  MarketplacePlatform,
  UserItemWithCatalog,
} from '@/types';
import { getItemListingDescription, getItemPictureUrls, getItemTitle } from '@/utils/items';

export interface ListItemInput {
  title: string;
  description: string;
  price: number;
  quantity: number;
  condition: string;
  imageUrls: string[];
  referenceId: string;
}

export interface MarketplaceAdapter {
  platform: MarketplacePlatform;
  listItem(input: ListItemInput, accessToken: string): Promise<MarketplaceListing>;
  syncListing(listing: MarketplaceListing, accessToken: string): Promise<MarketplaceListing>;
  endListing(listing: MarketplaceListing, accessToken: string): Promise<MarketplaceListing>;
}

export function userItemToListInput(item: UserItemWithCatalog): ListItemInput {
  return {
    title: getItemTitle(item),
    description: getItemListingDescription(item),
    price: item.price,
    quantity: item.quantity,
    condition: item.condition ?? 'Good',
    imageUrls: getItemPictureUrls(item),
    referenceId: item.referenceId,
  };
}

import { ebayAdapter } from './ebay';
import { tcgplayerAdapter } from './tcgplayer';
import { facebookAdapter } from './facebook';

export function getAdapter(platform: MarketplacePlatform): MarketplaceAdapter {
  switch (platform) {
    case 'ebay':
      return ebayAdapter;
    case 'tcgplayer':
      return tcgplayerAdapter;
    case 'facebook':
      return facebookAdapter;
  }
}
