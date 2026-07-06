import type { ItemListing } from '@/types';

/** Listing is locked after export through the app or when marked listed on eBay. */
export function isItemListingLocked(item: ItemListing): boolean {
  return !!item.ebayExportedAt || !!item.listedExternally;
}

export function isListedToggleOn(item: ItemListing): boolean {
  return isItemListingLocked(item);
}

/** Updates when the user toggles "Listed on eBay?" */
export function listingListedToggleUpdates(checked: boolean): Partial<ItemListing> {
  if (checked) {
    return {
      listedExternally: true,
      ebayListingStatus: 'active',
    };
  }
  return {
    listedExternally: false,
    ebayExportedAt: undefined,
    ebayListingStatus: undefined,
    ebayListingUrl: undefined,
  };
}
