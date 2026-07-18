import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CatalogItem,
  ItemCondition,
  ItemSource,
  LookupStatus,
  MarketplaceListings,
  MarketplacePlatform,
  PreferredImageSource,
  PricingMode,
  PricingSource,
  UserItem,
  UserItemWithCatalog,
  WorkflowStatus,
} from '@/types';
import { LOOKUP_STATUS } from '@/types';
import { generateReferenceId } from '@/utils/items';
import { rowToCatalogItem, type CatalogItemRow } from './catalog';

export interface UserItemRow {
  id: string;
  user_id: string;
  item_id: string | null;
  reference_id: string;
  query: string;
  custom_title: string | null;
  custom_description: string | null;
  quantity: number;
  condition: string | null;
  price: number;
  image_urls: string[] | null;
  category: string | null;
  workflow_status: WorkflowStatus;
  lookup_status: LookupStatus;
  pricing_mode: PricingMode;
  percent_below: number;
  pricing_source: PricingSource;
  selected_market_price_source: string | null;
  marketplace_listings: MarketplaceListings;
  target_platforms: string[];
  original_upc: string | null;
  original_sku: string | null;
  user_image_url: string | null;
  photo_url: string | null;
  preferred_image_source: string | null;
  notes: string;
  source: string;
  created_at: string;
  updated_at: string;
  items?: CatalogItemRow | CatalogItemRow[] | null;
}

function assertNoError(error: { message?: string } | null, operation: string): void {
  if (error) {
    console.error(`[supabase] ${operation}`, error);
    throw new Error(error.message || `Failed to ${operation}`);
  }
}

function normalizeImageUrls(imageUrls: string[] | null | undefined): string[] {
  return (imageUrls ?? []).filter(url => typeof url === 'string' && url.trim());
}

function parseTargetPlatforms(raw: string[] | null | undefined): MarketplacePlatform[] {
  const valid: MarketplacePlatform[] = ['ebay', 'tcgplayer', 'facebook'];
  return (raw ?? []).filter((p): p is MarketplacePlatform =>
    valid.includes(p as MarketplacePlatform),
  );
}

export function rowToUserItem(row: UserItemRow): UserItem {
  const imageUrls = normalizeImageUrls(row.image_urls);
  return {
    id: row.id,
    userId: row.user_id,
    itemId: row.item_id,
    referenceId: row.reference_id,
    query: row.query,
    customTitle: row.custom_title,
    customDescription: row.custom_description,
    quantity: row.quantity,
    condition: (row.condition as ItemCondition) ?? null,
    price: Number(row.price),
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    category: row.category,
    workflowStatus: row.workflow_status,
    lookupStatus: row.lookup_status,
    pricingMode: row.pricing_mode,
    percentBelow: row.percent_below,
    pricingSource: row.pricing_source,
    selectedMarketPriceSource: row.selected_market_price_source ?? null,
    marketplaceListings: row.marketplace_listings ?? {},
    targetPlatforms: parseTargetPlatforms(row.target_platforms),
    originalUpc: row.original_upc,
    originalSku: row.original_sku,
    userImageUrl: row.user_image_url,
    photoUrl: row.photo_url,
    preferredImageSource: (row.preferred_image_source as PreferredImageSource) ?? null,
    notes: row.notes,
    source: row.source as ItemSource,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function joinCatalog(row: UserItemRow): CatalogItem | null {
  const nested = row.items;
  if (!nested) return null;
  const catalogRow = Array.isArray(nested) ? nested[0] : nested;
  return catalogRow ? rowToCatalogItem(catalogRow) : null;
}

export function rowToUserItemWithCatalog(row: UserItemRow): UserItemWithCatalog {
  return {
    ...rowToUserItem(row),
    catalog: joinCatalog(row),
  };
}

const USER_ITEM_SELECT = `
  *,
  items (*)
`;

function userItemToInsertRow(item: UserItem, userId: string): Omit<UserItemRow, 'items'> {
  const imageUrls =
    item.imageUrls.length > 0
      ? item.imageUrls
      : item.imageUrl
        ? [item.imageUrl]
        : [];

  return {
    id: item.id,
    user_id: userId,
    item_id: item.itemId,
    reference_id: item.referenceId || generateReferenceId(),
    query: item.query,
    custom_title: item.customTitle,
    custom_description: item.customDescription,
    quantity: item.quantity,
    condition: item.condition,
    price: item.price,
    image_urls: imageUrls,
    category: item.category,
    workflow_status: item.workflowStatus,
    lookup_status: item.lookupStatus,
    pricing_mode: item.pricingMode,
    percent_below: item.percentBelow,
    pricing_source: item.pricingSource,
    selected_market_price_source: item.selectedMarketPriceSource,
    marketplace_listings: item.marketplaceListings,
    target_platforms: item.targetPlatforms,
    original_upc: item.originalUpc,
    original_sku: item.originalSku,
    user_image_url: item.userImageUrl,
    photo_url: item.photoUrl,
    preferred_image_source: item.preferredImageSource,
    notes: item.notes,
    source: item.source,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function userItemToUpdatePayload(item: UserItem) {
  const imageUrls =
    item.imageUrls.length > 0
      ? item.imageUrls
      : item.imageUrl
        ? [item.imageUrl]
        : [];

  return {
    item_id: item.itemId,
    reference_id: item.referenceId,
    query: item.query,
    custom_title: item.customTitle,
    custom_description: item.customDescription,
    quantity: item.quantity,
    condition: item.condition,
    price: item.price,
    image_urls: imageUrls,
    category: item.category,
    workflow_status: item.workflowStatus,
    lookup_status: item.lookupStatus,
    pricing_mode: item.pricingMode,
    percent_below: item.percentBelow,
    pricing_source: item.pricingSource,
    selected_market_price_source: item.selectedMarketPriceSource,
    marketplace_listings: item.marketplaceListings,
    target_platforms: item.targetPlatforms,
    original_upc: item.originalUpc,
    original_sku: item.originalSku,
    user_image_url: item.userImageUrl,
    photo_url: item.photoUrl,
    preferred_image_source: item.preferredImageSource,
    notes: item.notes,
    source: item.source,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchUserItems(
  supabase: SupabaseClient,
  userId: string,
  workflowStatus?: WorkflowStatus,
): Promise<UserItemWithCatalog[]> {
  let query = supabase
    .from('user_items')
    .select(USER_ITEM_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (workflowStatus) {
    query = query.eq('workflow_status', workflowStatus);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[supabase] fetchUserItems', error);
    throw error;
  }

  return (data as UserItemRow[]).map(rowToUserItemWithCatalog);
}

export async function fetchUserItem(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<UserItemWithCatalog | null> {
  const { data, error } = await supabase
    .from('user_items')
    .select(USER_ITEM_SELECT)
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[supabase] fetchUserItem', error);
    throw error;
  }

  return data ? rowToUserItemWithCatalog(data as UserItemRow) : null;
}

export async function insertUserItem(
  supabase: SupabaseClient,
  item: UserItem,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('user_items').insert(userItemToInsertRow(item, userId));
  assertNoError(error, 'save user item');
}

export async function updateUserItem(
  supabase: SupabaseClient,
  item: UserItem,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('user_items')
    .update(userItemToUpdatePayload(item))
    .eq('id', item.id)
    .eq('user_id', userId);
  assertNoError(error, 'update user item');
}

export async function deleteUserItem(
  supabase: SupabaseClient,
  id: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('user_items').delete().eq('id', id).eq('user_id', userId);
  assertNoError(error, 'delete user item');
}

export async function deleteUserItemsByStatus(
  supabase: SupabaseClient,
  userId: string,
  workflowStatus: WorkflowStatus,
): Promise<void> {
  const { error } = await supabase
    .from('user_items')
    .delete()
    .eq('user_id', userId)
    .eq('workflow_status', workflowStatus);
  assertNoError(error, 'delete user items by status');
}

export function createDefaultUserItem(
  userId: string,
  query: string,
  source: ItemSource,
  overrides: Partial<UserItem> = {},
): UserItem {
  const now = new Date().toISOString();
  const item: UserItem = {
    id: crypto.randomUUID(),
    userId,
    itemId: null,
    referenceId: generateReferenceId(),
    query,
    customTitle: null,
    customDescription: null,
    quantity: 1,
    condition: null,
    price: 0,
    imageUrl: null,
    imageUrls: [],
    category: null,
    workflowStatus: 'draft',
    lookupStatus: LOOKUP_STATUS.Idle,
    pricingMode: 'market',
    percentBelow: 10,
    pricingSource: 'amazon',
    selectedMarketPriceSource: null,
    marketplaceListings: {},
    targetPlatforms: [],
    originalUpc: null,
    originalSku: null,
    userImageUrl: null,
    photoUrl: null,
    preferredImageSource: null,
    notes: '',
    source,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  if (item.imageUrls.length === 0 && item.imageUrl) {
    item.imageUrls = [item.imageUrl];
  }
  if (!item.imageUrl && item.imageUrls[0]) {
    item.imageUrl = item.imageUrls[0];
  }

  return item;
}
