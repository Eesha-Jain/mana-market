/**
 * Background processor — resolves items via the backend (UPC + eBay).
 */
import { useEffect, useRef } from 'react';
import { useItems } from '../contexts/ItemsContext';
import { searchProduct } from '../utils/productApi';
import { resolveSearchParams } from '../utils/productLookup';

export function SearchProcessor() {
  const { items, updateItem } = useItems();
  const busy = useRef(false);

  useEffect(() => {
    const idle = items.find(i => i.status === 'idle' && !i.product);
    if (!idle || busy.current) return;

    busy.current = true;
    updateItem(idle.id, { status: 'searching' });

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
          status:  'found',
          product: result.product,
        });
        return;
      }

      if (result.type === 'ambiguous') {
        updateItem(id, {
          status:           'ambiguous',
          ambiguousResults: result.results,
        });
        return;
      }

      if (result.type === 'not_found' || result.type === 'unavailable') {
        updateItem(id, { status: 'not_found' });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return null;
}
