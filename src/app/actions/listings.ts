'use server';

import type { ItemListing } from '@/types';
import { requireAccessToken } from '@/lib/auth/server';
import { createServerSupabase } from '@/lib/supabase/server';
import * as listingsDb from '@/lib/db/listings';

export async function fetchListingsAction(accessToken: string): Promise<ItemListing[]> {
  const userId = await requireAccessToken(accessToken);
  const supabase = createServerSupabase(accessToken);
  return listingsDb.fetchListings(supabase, userId);
}

export async function insertListingAction(
  accessToken: string,
  item: ItemListing,
): Promise<void> {
  const userId = await requireAccessToken(accessToken);
  const supabase = createServerSupabase(accessToken);
  await listingsDb.insertListing(supabase, item, userId);
}

export async function updateListingAction(
  accessToken: string,
  item: ItemListing,
): Promise<void> {
  const userId = await requireAccessToken(accessToken);
  const supabase = createServerSupabase(accessToken);
  await listingsDb.updateListing(supabase, item, userId);
}

export async function deleteListingAction(
  accessToken: string,
  id: string,
): Promise<void> {
  const userId = await requireAccessToken(accessToken);
  const supabase = createServerSupabase(accessToken);
  await listingsDb.deleteListing(supabase, id, userId);
}

export async function deleteAllListingsAction(accessToken: string): Promise<void> {
  const userId = await requireAccessToken(accessToken);
  const supabase = createServerSupabase(accessToken);
  await listingsDb.deleteAllListings(supabase, userId);
}
