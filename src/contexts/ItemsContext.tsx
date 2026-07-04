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
import type { ItemListing, Product } from '../types';
import { generateListingId } from '../types';
import { useAuth } from './AuthContext';
import { useUserSettings } from './UserSettingsContext';
import { isSupabaseConfigured, getAccessToken } from '@/lib/supabase/client';
import {
  deleteAllListingsAction,
  deleteListingAction,
  fetchListingsAction,
  insertListingAction,
  updateListingAction,
} from '@/app/actions/listings';

type Action =
  | { type: 'SET_ITEMS'; items: ItemListing[] }
  | { type: 'ADD_ITEM'; item: ItemListing }
  | { type: 'UPDATE_ITEM'; id: string; updates: Partial<ItemListing> }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'CLEAR_ITEMS' };

function reducer(items: ItemListing[], action: Action): ItemListing[] {
  switch (action.type) {
    case 'SET_ITEMS':   return action.items;
    case 'ADD_ITEM':    return [...items, action.item];
    case 'UPDATE_ITEM': return items.map(i => i.id === action.id ? { ...i, ...action.updates } : i);
    case 'REMOVE_ITEM': return items.filter(i => i.id !== action.id);
    case 'CLEAR_ITEMS': return [];
    default:            return items;
  }
}

interface ItemsContextType {
  items: ItemListing[];
  isLoading: boolean;
  syncError: string | null;
  loadError: string | null;
  clearSyncError: () => void;
  clearLoadError: () => void;
  addItem: (query: string, source?: 'manual' | 'csv' | 'photo', overrides?: Partial<ItemListing>) => ItemListing;
  updateItem: (id: string, updates: Partial<ItemListing>) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
}

const ItemsContext = createContext<ItemsContextType | null>(null);

function localStorageKey(userId: string) {
  return `mtg_lister_items_${userId}`;
}

function formatSyncError(err: unknown, action: string): string {
  const detail = err instanceof Error ? err.message : String(err);
  return `Could not ${action}: ${detail}. Your local changes are kept but may not persist after refresh.`;
}

/** Migrate legacy items that used card / sealedProduct fields. */
function migrateStoredItem(raw: Record<string, unknown>): ItemListing {
  const { finish: _legacyFinish, ...cleaned } = raw;
  const item = cleaned as unknown as ItemListing;

  if (item.product) return item;

  const sealed = cleaned.sealedProduct as Product | undefined;
  if (sealed) {
    const { sealedProduct: _s, itemType: _t, ...rest } = cleaned;
    return { ...(rest as unknown as ItemListing), product: sealed };
  }

  const card = cleaned.selectedCard as Record<string, unknown> | undefined;
  if (card && typeof card.name === 'string') {
    const imageUris = card.image_uris as Record<string, string> | undefined;
    const prices = card.prices as Record<string, string | null> | undefined;
    const product: Product = {
      title: `${card.name}${card.set_name ? ` - ${card.set_name}` : ''}`,
      description: typeof card.oracle_text === 'string' ? card.oracle_text : '',
      imageUrls: imageUris?.normal ? [imageUris.normal] : [],
      marketPrice: prices?.usd ? parseFloat(prices.usd) : undefined,
      marketPriceSource: prices?.usd ? 'manual' : undefined,
    };
    const {
      selectedCard: _c, foundCard: _fc, allPrintings: _ap,
      ambiguousResults: _ar, itemType: _it, ...rest
    } = cleaned;
    return { ...(rest as unknown as ItemListing), product };
  }

  return item;
}

function ensureListingFields(item: ItemListing): ItemListing {
  return {
    ...item,
    listingId: item.listingId || generateListingId(),
  };
}

function makeItem(
  settings: { defaultMarketPricePreference: ItemListing['marketPricePreference'] },
  query: string,
  source: 'manual' | 'csv' | 'photo',
  overrides: Partial<ItemListing> = {},
): ItemListing {
  return {
    id: crypto.randomUUID(),
    listingId: generateListingId(),
    query,
    status: 'idle',
    quantity: 1,
    condition: null,
    pricingMode: 'market',
    percentBelow: 10,
    manualPrice: 0,
    notes: '',
    marketPricePreference: settings.defaultMarketPricePreference ?? 'ebay',
    source,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function ItemsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const [items, setItems] = useState<ItemListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const dispatchItems = useCallback((action: Action) => {
    setItems(prev => {
      const next = reducer(prev, action);
      itemsRef.current = next;
      return next;
    });
  }, []);

  const clearSyncError = useCallback(() => setSyncError(null), []);
  const clearLoadError = useCallback(() => setLoadError(null), []);

  useEffect(() => {
    if (!user) {
      dispatchItems({ type: 'CLEAR_ITEMS' });
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    if (isSupabaseConfigured()) {
      setIsLoading(true);
      setLoadError(null);
      void getAccessToken()
        .then(async token => {
          if (!token) throw new Error('Not signed in');
          return fetchListingsAction(token);
        })
        .then(loaded => dispatchItems({ type: 'SET_ITEMS', items: loaded.map(ensureListingFields) }))
        .catch(err => {
          setLoadError(formatSyncError(err, 'load your listings'));
        })
        .finally(() => setIsLoading(false));
      return;
    }

    try {
      const raw = localStorage.getItem(localStorageKey(user.id));
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>[];
        dispatchItems({
          type: 'SET_ITEMS',
          items: parsed.map(r => ensureListingFields(migrateStoredItem(r))),
        });
      } else {
        dispatchItems({ type: 'CLEAR_ITEMS' });
      }
    } catch {
      dispatchItems({ type: 'CLEAR_ITEMS' });
      setLoadError('Could not read saved listings from this browser.');
    }
    setIsLoading(false);
  }, [user?.id, dispatchItems]);

  useEffect(() => {
    if (!user || isSupabaseConfigured()) return;
    localStorage.setItem(localStorageKey(user.id), JSON.stringify(items));
  }, [items, user?.id]);

  const addItem = (
    query: string,
    source: 'manual' | 'csv' | 'photo' = 'manual',
    overrides: Partial<ItemListing> = {},
  ) => {
    const item = makeItem(settings, query, source, overrides);
    dispatchItems({ type: 'ADD_ITEM', item });
    if (user && isSupabaseConfigured()) {
      void getAccessToken().then(token => {
        if (!token) return;
        void insertListingAction(token, item).catch(err => {
          setSyncError(formatSyncError(err, 'save listing'));
        });
      });
    }
    return item;
  };

  const updateItem = (id: string, updates: Partial<ItemListing>) => {
    dispatchItems({ type: 'UPDATE_ITEM', id, updates });

    queueMicrotask(() => {
      const merged = itemsRef.current.find(i => i.id === id);
      if (merged && user && isSupabaseConfigured()) {
        void getAccessToken().then(token => {
          if (!token) return;
          void updateListingAction(token, merged).catch(err => {
            setSyncError(formatSyncError(err, 'update listing'));
          });
        });
      }
    });
  };

  const removeItem = (id: string) => {
    dispatchItems({ type: 'REMOVE_ITEM', id });
    if (user && isSupabaseConfigured()) {
      void getAccessToken().then(token => {
        if (!token) return;
        void deleteListingAction(token, id).catch(err => {
          setSyncError(formatSyncError(err, 'delete listing'));
        });
      });
    }
  };

  const clearItems = () => {
    dispatchItems({ type: 'CLEAR_ITEMS' });
    if (user && isSupabaseConfigured()) {
      void getAccessToken().then(token => {
        if (!token) return;
        void deleteAllListingsAction(token).catch(err => {
          setSyncError(formatSyncError(err, 'clear listings'));
        });
      });
    }
  };

  return (
    <ItemsContext.Provider
      value={{
        items,
        isLoading,
        syncError,
        loadError,
        clearSyncError,
        clearLoadError,
        addItem,
        updateItem,
        removeItem,
        clearItems,
      }}
    >
      {children}
    </ItemsContext.Provider>
  );
}

export function useItems() {
  const ctx = useContext(ItemsContext);
  if (!ctx) throw new Error('useItems must be inside <ItemsProvider>');
  return ctx;
}
