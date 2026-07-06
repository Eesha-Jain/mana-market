import { ITEM_STATUS, type ItemListing, type ItemStatus } from '../types';

export interface ItemStatusCounts {
  pending: number;
  found: number;
  ambiguous: number;
  notFound: number;
}

const ALL_STATUSES: ItemStatus[] = Object.values(ITEM_STATUS);

export function isItemStatus(value: string): value is ItemStatus {
  return (ALL_STATUSES as string[]).includes(value);
}

export function isItemIdle(item: ItemListing): boolean {
  return item.status === ITEM_STATUS.Idle;
}

export function isItemSearching(item: ItemListing): boolean {
  return item.status === ITEM_STATUS.Searching;
}

/** Queued or actively resolving via product lookup. */
export function isItemPending(item: ItemListing): boolean {
  return isItemIdle(item) || isItemSearching(item);
}

export function isItemFound(item: ItemListing): boolean {
  return item.status === ITEM_STATUS.Found;
}

export function isItemAmbiguous(item: ItemListing): boolean {
  return item.status === ITEM_STATUS.Ambiguous;
}

export function isItemNotFound(item: ItemListing): boolean {
  return item.status === ITEM_STATUS.NotFound;
}

export function isItemFoundWithProduct(item: ItemListing): boolean {
  return isItemFound(item) && !!item.product;
}

export function isItemFoundMissingCondition(item: ItemListing): boolean {
  return isItemFound(item) && !item.condition;
}

/** Review filter: ambiguous, not found, or found but missing condition. */
export function isItemNeedsAction(item: ItemListing): boolean {
  return isItemAmbiguous(item) || isItemNotFound(item) || isItemFoundMissingCondition(item);
}

export function isItemUnresolvedNotFound(item: ItemListing): boolean {
  return isItemNotFound(item) && !item.product;
}

export function isItemUnresolvedAmbiguous(item: ItemListing): boolean {
  return isItemAmbiguous(item) && !item.product;
}

export function findNextIdleItem(items: ItemListing[]): ItemListing | undefined {
  return items.find(i => isItemIdle(i) && !i.product);
}

export function statusFromProductMatch(hasProduct: boolean): ItemStatus {
  return hasProduct ? ITEM_STATUS.Found : ITEM_STATUS.NotFound;
}

export function countItemStatuses(items: ItemListing[]): ItemStatusCounts {
  return {
    pending: items.filter(isItemPending).length,
    found: items.filter(isItemFound).length,
    ambiguous: items.filter(isItemAmbiguous).length,
    notFound: items.filter(isItemNotFound).length,
  };
}

export function getItemStatusLabel(status: ItemStatus): string {
  switch (status) {
    case ITEM_STATUS.Found:
      return 'Ready to customize';
    case ITEM_STATUS.Ambiguous:
      return 'Multiple matches — select a product';
    case ITEM_STATUS.NotFound:
      return 'Not found online';
    case ITEM_STATUS.Idle:
    case ITEM_STATUS.Searching:
      return 'Searching…';
    default:
      return status;
  }
}
