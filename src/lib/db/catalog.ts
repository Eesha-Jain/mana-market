import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CatalogItem, CatalogSnapshot } from '@/types';

export interface CatalogItemRow {
  id: string;
  upc: string | null;
  asin: string | null;
  title: string;
  description: string;
  default_category: string | null;
  catalog_snapshot: CatalogSnapshot;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

function assertNoError(error: { message?: string } | null, operation: string): void {
  if (error) {
    console.error(`[supabase] ${operation}`, error);
    throw new Error(error.message || `Failed to ${operation}`);
  }
}

export function rowToCatalogItem(row: CatalogItemRow): CatalogItem {
  return {
    id: row.id,
    upc: row.upc,
    asin: row.asin,
    title: row.title,
    description: row.description,
    defaultCategory: row.default_category,
    catalogSnapshot: row.catalog_snapshot ?? {},
    lastFetchedAt: row.last_fetched_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findCatalogItemByUpc(
  supabase: SupabaseClient,
  upc: string,
): Promise<CatalogItem | null> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('upc', upc)
    .maybeSingle();

  if (error) {
    console.error('[supabase] findCatalogItemByUpc', error);
    throw error;
  }

  return data ? rowToCatalogItem(data as CatalogItemRow) : null;
}

export async function upsertCatalogItem(
  supabase: SupabaseClient,
  input: {
    upc?: string | null;
    asin?: string | null;
    title: string;
    description: string;
    defaultCategory?: string | null;
    catalogSnapshot: CatalogSnapshot;
  },
): Promise<CatalogItem> {
  const now = new Date().toISOString();
  const payload = {
    upc: input.upc ?? null,
    asin: input.asin ?? null,
    title: input.title,
    description: input.description,
    default_category: input.defaultCategory ?? null,
    catalog_snapshot: input.catalogSnapshot,
    last_fetched_at: now,
    updated_at: now,
  };

  if (input.upc) {
    const { data, error } = await supabase
      .from('items')
      .upsert(payload, { onConflict: 'upc' })
      .select('*')
      .single();
    assertNoError(error, 'upsert catalog item');
    return rowToCatalogItem(data as CatalogItemRow);
  }

  const { data, error } = await supabase
    .from('items')
    .insert(payload)
    .select('*')
    .single();
  assertNoError(error, 'insert catalog item');
  return rowToCatalogItem(data as CatalogItemRow);
}

export async function fetchCatalogItem(
  supabase: SupabaseClient,
  id: string,
): Promise<CatalogItem | null> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[supabase] fetchCatalogItem', error);
    throw error;
  }

  return data ? rowToCatalogItem(data as CatalogItemRow) : null;
}
