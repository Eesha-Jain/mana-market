import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ItemListing, Product } from '@/types';
import { generateListingId } from '@/types';

export interface ListingRow {
  id: string;
  user_id: string;
  listing_id: string;
  query: string;
  status: string;
  original_upc: string | null;
  original_sku: string | null;
  product: Product | null;
  ambiguous_results: Product[] | null;
  custom_title: string | null;
  custom_description: string | null;
  quantity: number;
  condition: string | null;
  pricing_mode: string;
  percent_below: number;
  manual_price: number;
  market_price_preference: string | null;
  selected_market_price_source: string | null;
  notes: string;
  ebay_exported_at: string | null;
  ebay_listing_status: string | null;
  photo_url: string | null;
  user_image_url: string | null;
  preferred_image_source: string | null;
  detected_product_type: string | null;
  detected_card_count: string | null;
  source: string;
  created_at: string;
}

function assertNoError(error: { message?: string } | null, operation: string): void {
  if (error) {
    console.error(`[supabase] ${operation}`, error);
    throw new Error(error.message || `Failed to ${operation}`);
  }
}

export function rowToListing(row: ListingRow): ItemListing {
  return {
    id: row.id,
    listingId: row.listing_id,
    query: row.query,
    status: row.status as ItemListing['status'],
    originalUpc: row.original_upc ?? undefined,
    originalSku: row.original_sku ?? undefined,
    product: row.product ?? undefined,
    ambiguousResults: row.ambiguous_results ?? undefined,
    customTitle: row.custom_title ?? undefined,
    customDescription: row.custom_description ?? undefined,
    quantity: row.quantity,
    condition: (row.condition as ItemListing['condition']) ?? null,
    pricingMode: row.pricing_mode as ItemListing['pricingMode'],
    percentBelow: row.percent_below,
    manualPrice: Number(row.manual_price),
    marketPricePreference: (row.market_price_preference as ItemListing['marketPricePreference']) ?? undefined,
    selectedMarketPriceSource: (row.selected_market_price_source as ItemListing['selectedMarketPriceSource']) ?? undefined,
    notes: row.notes,
    ebayExportedAt: row.ebay_exported_at ?? undefined,
    ebayListingStatus: (row.ebay_listing_status as ItemListing['ebayListingStatus']) ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    userImageUrl: row.user_image_url ?? undefined,
    preferredImageSource: (row.preferred_image_source as ItemListing['preferredImageSource']) ?? undefined,
    detectedProductType: row.detected_product_type ?? undefined,
    detectedCardCount: row.detected_card_count ?? undefined,
    source: row.source as ItemListing['source'],
    createdAt: row.created_at,
  };
}

function listingToRow(item: ItemListing, userId: string): ListingRow {
  return {
    id: item.id,
    user_id: userId,
    listing_id: item.listingId || generateListingId(),
    query: item.query,
    status: item.status,
    original_upc: item.originalUpc ?? null,
    original_sku: item.originalSku ?? null,
    product: item.product ?? null,
    ambiguous_results: item.ambiguousResults ?? null,
    custom_title: item.customTitle ?? null,
    custom_description: item.customDescription ?? null,
    quantity: item.quantity,
    condition: item.condition,
    pricing_mode: item.pricingMode,
    percent_below: item.percentBelow,
    manual_price: item.manualPrice,
    market_price_preference: item.marketPricePreference ?? null,
    selected_market_price_source: item.selectedMarketPriceSource ?? null,
    notes: item.notes,
    ebay_exported_at: item.ebayExportedAt ?? null,
    ebay_listing_status: item.ebayListingStatus ?? null,
    photo_url: item.photoUrl ?? null,
    user_image_url: item.userImageUrl ?? null,
    preferred_image_source: item.preferredImageSource ?? null,
    detected_product_type: item.detectedProductType ?? null,
    detected_card_count: item.detectedCardCount ?? null,
    source: item.source,
    created_at: item.createdAt,
  };
}

function listingToUpdatePayload(item: ItemListing) {
  return {
    listing_id: item.listingId,
    query: item.query,
    status: item.status,
    original_upc: item.originalUpc ?? null,
    original_sku: item.originalSku ?? null,
    product: item.product ?? null,
    ambiguous_results: item.ambiguousResults ?? null,
    custom_title: item.customTitle ?? null,
    custom_description: item.customDescription ?? null,
    quantity: item.quantity,
    condition: item.condition,
    pricing_mode: item.pricingMode,
    percent_below: item.percentBelow,
    manual_price: item.manualPrice,
    market_price_preference: item.marketPricePreference ?? null,
    selected_market_price_source: item.selectedMarketPriceSource ?? null,
    notes: item.notes,
    ebay_exported_at: item.ebayExportedAt ?? null,
    ebay_listing_status: item.ebayListingStatus ?? null,
    photo_url: item.photoUrl ?? null,
    user_image_url: item.userImageUrl ?? null,
    preferred_image_source: item.preferredImageSource ?? null,
    detected_product_type: item.detectedProductType ?? null,
    detected_card_count: item.detectedCardCount ?? null,
    source: item.source,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchListings(
  supabase: SupabaseClient,
  userId: string,
): Promise<ItemListing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[supabase] fetchListings', error);
    throw error;
  }

  return (data as ListingRow[]).map(rowToListing);
}

export async function insertListing(
  supabase: SupabaseClient,
  item: ItemListing,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('listings').insert(listingToRow(item, userId));
  assertNoError(error, 'save listing');
}

export async function updateListing(
  supabase: SupabaseClient,
  item: ItemListing,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .update(listingToUpdatePayload(item))
    .eq('id', item.id)
    .eq('user_id', userId);

  assertNoError(error, 'update listing');
}

export async function deleteListing(
  supabase: SupabaseClient,
  id: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('listings').delete().eq('id', id).eq('user_id', userId);
  assertNoError(error, 'delete listing');
}

export async function deleteAllListings(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('listings').delete().eq('user_id', userId);
  assertNoError(error, 'clear listings');
}
