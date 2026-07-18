'use client';

/**
 * Legacy ItemsContext — inventory now lives in InventoryContext.
 * Kept as a thin re-export so old imports keep compiling during migration.
 */
export {
  InventoryProvider as ItemsProvider,
  useInventory,
  useItems,
} from './InventoryContext';
