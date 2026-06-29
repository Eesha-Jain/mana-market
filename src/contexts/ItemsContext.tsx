import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ItemListing, EbayCondition, Product } from '../types';
import { generateListingId } from '../types';
import { useAuth } from './AuthContext';
import { useUserSettings } from './UserSettingsContext';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  deleteAllListings,
  deleteListing,
  fetchListings,
  insertListing,
  insertListings,
  patchListing,
} from '../lib/supabaseDb';

type Action =
  | { type: 'SET_ITEMS'; items: ItemListing[] }
  | { type: 'ADD_ITEM'; item: ItemListing }
  | { type: 'ADD_ITEMS'; items: ItemListing[] }
  | { type: 'UPDATE_ITEM'; id: string; updates: Partial<ItemListing> }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'CLEAR_ITEMS' };

function reducer(items: ItemListing[], action: Action): ItemListing[] {
  switch (action.type) {
    case 'SET_ITEMS':   return action.items;
    case 'ADD_ITEM':    return [...items, action.item];
    case 'ADD_ITEMS':   return [...items, ...action.items];
    case 'UPDATE_ITEM': return items.map(i => i.id === action.id ? { ...i, ...action.updates } : i);
    case 'REMOVE_ITEM': return items.filter(i => i.id !== action.id);
    case 'CLEAR_ITEMS': return [];
    default:            return items;
  }
}

interface ItemsContextType {
  items: ItemListing[];
  isLoading: boolean;
  addItem: (query: string, source?: 'manual' | 'csv' | 'photo', overrides?: Partial<ItemListing>) => ItemListing;
  addItems: (rows: AddItemRow[]) => ItemListing[];
  updateItem: (id: string, updates: Partial<ItemListing>) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
}

interface AddItemRow {
  query: string;
  originalUpc?: string;
  originalSku?: string;
  quantity?: number;
  condition?: EbayCondition | null;
  notes?: string;
  manualPrice?: number;
  photoUrl?: string;
  source?: 'manual' | 'csv' | 'photo';
}

const ItemsContext = createContext<ItemsContextType | null>(null);

function localStorageKey(userId: string) {
  return `mtg_lister_items_${userId}`;
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
  const [items, dispatch] = useReducer(reducer, []);
  const [isLoading, setIsLoading] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (!user) {
      dispatch({ type: 'CLEAR_ITEMS' });
      setIsLoading(false);
      return;
    }

    if (isSupabaseConfigured()) {
      setIsLoading(true);
      fetchListings(user.id)
        .then(loaded => dispatch({ type: 'SET_ITEMS', items: loaded.map(ensureListingFields) }))
        .catch(() => dispatch({ type: 'CLEAR_ITEMS' }))
        .finally(() => setIsLoading(false));
      return;
    }

    try {
      const raw = localStorage.getItem(localStorageKey(user.id));
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>[];
        dispatch({
          type: 'SET_ITEMS',
          items: parsed.map(r => ensureListingFields(migrateStoredItem(r))),
        });
      } else {
        dispatch({ type: 'CLEAR_ITEMS' });
      }
    } catch {
      dispatch({ type: 'CLEAR_ITEMS' });
    }
    setIsLoading(false);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || isSupabaseConfigured()) return;
    localStorage.setItem(localStorageKey(user.id), JSON.stringify(items));
  }, [items, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = (
    query: string,
    source: 'manual' | 'csv' | 'photo' = 'manual',
    overrides: Partial<ItemListing> = {},
  ) => {
    const item = makeItem(settings, query, source, overrides);
    dispatch({ type: 'ADD_ITEM', item });
    if (user && isSupabaseConfigured()) {
      void insertListing(item, user.id);
    }
    return item;
  };

  const addItems = (rows: AddItemRow[]) => {
    const newItems = rows.map(r =>
      makeItem(settings, r.query, r.source ?? 'csv', {
        originalUpc: r.originalUpc,
        originalSku: r.originalSku,
        quantity:    r.quantity ?? 1,
        condition:   r.condition ?? null,
        notes:       r.notes ?? '',
        manualPrice: r.manualPrice ?? 0,
        photoUrl:    r.photoUrl,
        pricingMode: r.manualPrice ? 'manual' : 'market',
      })
    );
    dispatch({ type: 'ADD_ITEMS', items: newItems });
    if (user && isSupabaseConfigured()) {
      void insertListings(newItems, user.id);
    }
    return newItems;
  };

  const updateItem = (id: string, updates: Partial<ItemListing>) => {
    dispatch({ type: 'UPDATE_ITEM', id, updates });
    if (user && isSupabaseConfigured()) {
      const current = itemsRef.current.find(i => i.id === id);
      if (current) {
        void patchListing(id, user.id, current, updates);
      }
    }
  };

  const removeItem = (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', id });
    if (user && isSupabaseConfigured()) {
      void deleteListing(id, user.id);
    }
  };

  const clearItems = () => {
    dispatch({ type: 'CLEAR_ITEMS' });
    if (user && isSupabaseConfigured()) {
      void deleteAllListings(user.id);
    }
  };

  return (
    <ItemsContext.Provider value={{ items, isLoading, addItem, addItems, updateItem, removeItem, clearItems }}>
      {children}
    </ItemsContext.Provider>
  );
}

export function useItems() {
  const ctx = useContext(ItemsContext);
  if (!ctx) throw new Error('useItems must be inside <ItemsProvider>');
  return ctx;
}
