'use client';

/**
 * Background processor — resolves legacy idle items via the backend (UPC + eBay).
 * Upload and photo flows set status + product during entry review; this handles
 * any remaining idle rows (e.g. older data or programmatic addItem without overrides).
 */
import { useEffect, useRef } from 'react';
import { useItems } from '@/contexts/ItemsContext';
import { ITEM_STATUS } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { searchProduct } from '@/utils/productApi';
import { resolveSearchParams } from '@/utils/productLookup';
import { findNextIdleItem } from '@/utils/itemStatus';

export function SearchProcessor() {
  const { items, updateItem } = useItems();
  const toast = useToast();
  const busy = useRef(false);
  const lastUnavailableToastRef = useRef<string | null>(null);

  useEffect(() => {
    const idle = findNextIdleItem(items);
    if (!idle || busy.current) return;

    busy.current = true;
    updateItem(idle.id, { status: ITEM_STATUS.Searching });

    processItem(idle.id, idle.query, idle.originalUpc, idle.originalSku)
      .finally(() => {
        setTimeout(() => { busy.current = false; }, 150);
      });

    async function processItem(
      id: string,
      query: string,
      originalUpc?: string,
      originalSku?: string,
    ) {
      const { query: searchQuery, upc, sku } = resolveSearchParams(query, {
        originalUpc,
        originalSku,
      });

      const result = await searchProduct(searchQuery, upc, sku).catch(
        () => ({ type: 'unavailable' as const, reason: 'network error' }),
      );

      if (result.type === 'found') {
        updateItem(id, {
          status: ITEM_STATUS.Found,
          product: result.product,
        });
        return;
      }

      if (result.type === 'ambiguous') {
        updateItem(id, {
          status: ITEM_STATUS.Ambiguous,
          ambiguousResults: result.results,
        });
        return;
      }

      if (result.type === 'not_found' || result.type === 'unavailable') {
        if (result.type === 'unavailable') {
          const reason = result.reason || 'Product lookup is unavailable.';
          if (reason !== lastUnavailableToastRef.current) {
            lastUnavailableToastRef.current = reason;
            toast.error(`Lookup failed for "${query}": ${reason}`);
          }
        }
        updateItem(id, { status: ITEM_STATUS.NotFound });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return null;
}
