/**
 * Legacy status helpers — prefer importing from `@/utils/items`.
 * Re-exported here so older modules keep compiling.
 */
export {
  isItemFound,
  isItemAmbiguous,
  isItemNotFound,
  isItemPending,
  isItemIdle,
  isItemSearching,
  isItemFoundWithProduct,
  isItemFoundMissingCondition,
  isItemNeedsAction,
  isItemUnresolvedNotFound,
  isItemUnresolvedAmbiguous,
  findNextIdleItem,
  countLookupStatuses as countItemStatuses,
  getLookupStatusLabel,
  getItemStatusLabel,
  isLookupStatus as isItemStatus,
  statusFromProductMatch,
  type LookupStatusCounts as ItemStatusCounts,
} from './items';
