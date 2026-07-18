'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Product, UserItem, UserItemWithCatalog, ItemSource, WorkflowStatus } from '../types';
import { productToCatalogSnapshot } from '@/utils/items';
import { LOOKUP_STATUS } from '../types';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useUserSettings } from './UserSettingsContext';
import { resolveMarketPricePreference, type UserSettings } from '../utils/settings';
import { getAccessToken } from '@/lib/supabase/client';
import {
  createUserItemAction,
  deleteUserItemAction,
  fetchInventoryAction,
  updateUserItemAction,
  upsertCatalogForUserItemAction,
} from '@/lib/inventory/actions';

type Action =
  | { type: 'SET_ITEMS'; items: UserItemWithCatalog[] }
  | { type: 'ADD_ITEM'; item: UserItemWithCatalog }
  | { type: 'UPDATE_ITEM'; id: string; updates: Partial<UserItemWithCatalog> }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'CLEAR_ITEMS' };

function reducer(items: UserItemWithCatalog[], action: Action): UserItemWithCatalog[] {
  switch (action.type) {
    case 'SET_ITEMS':
      return action.items;
    case 'ADD_ITEM':
      return [...items, action.item];
    case 'UPDATE_ITEM':
      return items.map(i => (i.id === action.id ? { ...i, ...action.updates } : i));
    case 'REMOVE_ITEM':
      return items.filter(i => i.id !== action.id);
    case 'CLEAR_ITEMS':
      return [];
    default:
      return items;
  }
}

interface InventoryContextType {
  items: UserItemWithCatalog[];
  isLoading: boolean;
  addItem: (
    query: string,
    source?: ItemSource,
    overrides?: Partial<UserItem> & { product?: Product },
  ) => Promise<UserItemWithCatalog>;
  updateItem: (id: string, updates: Partial<UserItemWithCatalog>) => void;
  /** Persist review fields (+ optional catalog) immediately — used by upload modal. */
  applyReviewToItem: (
    id: string,
    updates: Partial<UserItem> & { product?: Product },
  ) => Promise<UserItemWithCatalog>;
  removeItem: (id: string) => void;
  refreshItems: (workflowStatus?: WorkflowStatus) => Promise<void>;
  getItemsByWorkflow: (status: WorkflowStatus) => UserItemWithCatalog[];
}

const InventoryContext = createContext<InventoryContextType | null>(null);

function pricingSourceFromSettings(settings: UserSettings): UserItem['pricingSource'] {
  const pref = resolveMarketPricePreference(settings);
  if (pref === 'upc') return 'upc';
  return 'amazon';
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const toast = useToast();
  const [items, setItems] = useState<UserItemWithCatalog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const syncTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dispatchItems = useCallback((action: Action) => {
    setItems(prev => {
      const next = reducer(prev, action);
      itemsRef.current = next;
      return next;
    });
  }, []);

  const refreshItems = useCallback(
    async (workflowStatus?: WorkflowStatus) => {
      if (!user) return;
      setIsLoading(true);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('Not signed in');
        const loaded = await fetchInventoryAction(token, workflowStatus);
        if (workflowStatus) {
          const other = itemsRef.current.filter(i => i.workflowStatus !== workflowStatus);
          dispatchItems({ type: 'SET_ITEMS', items: [...other, ...loaded] });
        } else {
          dispatchItems({ type: 'SET_ITEMS', items: loaded });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load inventory');
      } finally {
        setIsLoading(false);
      }
    },
    [user, dispatchItems, toast],
  );

  useEffect(() => {
    if (!user) {
      dispatchItems({ type: 'CLEAR_ITEMS' });
      setIsLoading(false);
      return;
    }
    void refreshItems();
  }, [user?.id, dispatchItems, refreshItems]);

  useEffect(() => {
    const timers = syncTimersRef.current;
    return () => {
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const addItem = async (
    query: string,
    source: ItemSource = 'manual',
    overrides: Partial<UserItem> & { product?: Product } = {},
  ): Promise<UserItemWithCatalog> => {
    if (!user) throw new Error('Not signed in');

    const { product, ...itemOverrides } = overrides;
    const token = await getAccessToken();
    if (!token) throw new Error('Not signed in');

    const item = await createUserItemAction(token, {
      query,
      source,
      overrides: {
        pricingSource: pricingSourceFromSettings(settings),
        ...itemOverrides,
        lookupStatus:
          itemOverrides.lookupStatus ??
          (product ? LOOKUP_STATUS.Found : LOOKUP_STATUS.Idle),
      },
      catalog: product
        ? {
            upc: product.upc ?? itemOverrides.originalUpc ?? null,
            asin: product.asin ?? null,
            title: product.title,
            description: product.description,
            catalogSnapshot: productToCatalogSnapshot(product),
          }
        : undefined,
    });

    dispatchItems({ type: 'ADD_ITEM', item });
    return item;
  };

  const updateItem = (id: string, updates: Partial<UserItemWithCatalog>) => {
    dispatchItems({ type: 'UPDATE_ITEM', id, updates });

    const existingTimer = syncTimersRef.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);

    syncTimersRef.current.set(
      id,
      setTimeout(() => {
        syncTimersRef.current.delete(id);
        const merged = itemsRef.current.find(i => i.id === id);
        if (!merged || !user) return;

        void getAccessToken().then(token => {
          if (!token) return;
          const { catalog: _catalog, ...userItem } = merged;
          void updateUserItemAction(token, userItem).catch(err => {
            toast.error(err instanceof Error ? err.message : 'Failed to save changes');
          });
        });
      }, 400),
    );
  };

  const applyReviewToItem = async (
    id: string,
    updates: Partial<UserItem> & { product?: Product },
  ): Promise<UserItemWithCatalog> => {
    if (!user) throw new Error('Not signed in');
    const token = await getAccessToken();
    if (!token) throw new Error('Not signed in');

    const { product, ...itemUpdates } = updates;
    const existing = itemsRef.current.find(i => i.id === id);
    if (!existing) throw new Error('Item not found');

    let next: UserItemWithCatalog = {
      ...existing,
      ...itemUpdates,
      updatedAt: new Date().toISOString(),
    };

    if (product) {
      next = await upsertCatalogForUserItemAction(token, id, {
        upc: product.upc ?? itemUpdates.originalUpc ?? existing.originalUpc ?? null,
        asin: product.asin ?? null,
        title: product.title,
        description: product.description,
        catalogSnapshot: productToCatalogSnapshot(product),
      });
      next = {
        ...next,
        ...itemUpdates,
        catalog: next.catalog ?? existing.catalog,
        updatedAt: new Date().toISOString(),
      };
    }

    const { catalog: _catalog, ...userItem } = next;
    await updateUserItemAction(token, userItem);
    dispatchItems({ type: 'UPDATE_ITEM', id, updates: next });
    return next;
  };

  const removeItem = (id: string) => {
    dispatchItems({ type: 'REMOVE_ITEM', id });
    void getAccessToken().then(token => {
      if (!token) return;
      void deleteUserItemAction(token, id).catch(err => {
        toast.error(err instanceof Error ? err.message : 'Failed to delete item');
      });
    });
  };

  const getItemsByWorkflow = (status: WorkflowStatus) =>
    items.filter(i => i.workflowStatus === status);

  return (
    <InventoryContext.Provider
      value={{
        items,
        isLoading,
        addItem,
        updateItem,
        applyReviewToItem,
        removeItem,
        refreshItems,
        getItemsByWorkflow,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be inside <InventoryProvider>');
  return ctx;
}

/** @deprecated Use useInventory */
export function useItems() {
  return useInventory();
}
