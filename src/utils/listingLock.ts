import type { UserItemWithCatalog } from '@/types';
import { WORKFLOW_STATUS } from '@/types';

/** Listing is locked once it has an active marketplace listing or is marked Listed. */
export function isItemListingLocked(item: UserItemWithCatalog): boolean {
  const listings = item.marketplaceListings ?? {};
  if (Object.keys(listings).length > 0) return true;
  return item.workflowStatus === WORKFLOW_STATUS.Listed || item.workflowStatus === WORKFLOW_STATUS.Sold;
}

export function isListedToggleOn(item: UserItemWithCatalog): boolean {
  return isItemListingLocked(item);
}

/** Updates when the user toggles "listed externally" style tracking. */
export function listingListedToggleUpdates(
  checked: boolean,
): Partial<UserItemWithCatalog> {
  if (checked) {
    return { workflowStatus: WORKFLOW_STATUS.Listed };
  }
  return { workflowStatus: WORKFLOW_STATUS.Ready };
}
