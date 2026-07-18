'use client';

import { useEffect, useRef } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import type { UserItemWithCatalog } from '@/types';
import { LOOKUP_STATUS } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { searchProduct } from '@/utils/search';
import { resolveSearchParams } from '@/utils/search';
import { findNextIdleItem } from '@/utils/items';
import { productToCatalogSnapshot } from '@/utils/items';
import { getAccessToken } from '@/lib/supabase/client';
import { upsertCatalogForUserItemAction } from '@/lib/inventory/actions';

export function SearchProcessor() {
  const { items, updateItem } = useInventory();
  const toast = useToast();
  const busy = useRef(false);
  const lastUnavailableToastRef = useRef<string | null>(null);

  useEffect(() => {
    const idle = findNextIdleItem(items);
    if (!idle || busy.current) return;

    busy.current = true;
    updateItem(idle.id, { lookupStatus: LOOKUP_STATUS.Searching });

    processItem(idle.id, idle.query, idle.originalUpc, idle.originalSku, idle.catalog).finally(() => {
      setTimeout(() => {
        busy.current = false;
      }, 150);
    });

    async function processItem(
      id: string,
      query: string,
      originalUpc?: string | null,
      originalSku?: string | null,
      existingCatalog?: UserItemWithCatalog['catalog'],
    ) {
      const { query: searchQuery, upc, sku } = resolveSearchParams(query, {
        originalUpc: originalUpc ?? undefined,
        originalSku: originalSku ?? undefined,
      });

      const result = await searchProduct(searchQuery, upc, sku).catch(
        () => ({ type: 'unavailable' as const, reason: 'network error' }),
      );

      if (result.type === 'found') {
        const token = await getAccessToken();
        if (token) {
          try {
            const saved = await upsertCatalogForUserItemAction(token, id, {
              upc: result.product.upc ?? upc ?? null,
              asin: result.product.asin ?? null,
              title: result.product.title,
              description: result.product.description,
              catalogSnapshot: productToCatalogSnapshot(result.product),
            });
            updateItem(id, {
              lookupStatus: LOOKUP_STATUS.Found,
              catalog: saved.catalog,
              itemId: saved.itemId,
            });
            return;
          } catch {
            // fall through to local update
          }
        }
        updateItem(id, { lookupStatus: LOOKUP_STATUS.Found });
        return;
      }

      if (result.type === 'ambiguous') {
        updateItem(id, {
          lookupStatus: LOOKUP_STATUS.Ambiguous,
          catalog: existingCatalog
            ? {
                ...existingCatalog,
                catalogSnapshot: {
                  ...existingCatalog.catalogSnapshot,
                  ambiguousResults: result.results.map(productToCatalogSnapshot),
                },
              }
            : null,
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
        updateItem(id, { lookupStatus: LOOKUP_STATUS.NotFound });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return null;
}
