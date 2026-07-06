'use server';

import type { ItemListing } from '@/types';
import { withAuthenticatedClient } from '@/lib/auth/server';
import * as listingsDb from '@/lib/db/listings';

export async function fetchListingsAction(accessToken: string): Promise<ItemListing[]> {
  return withAuthenticatedClient(accessToken, (supabase, userId) =>
    listingsDb.fetchListings(supabase, userId),
  );
}

export async function insertListingAction(
  accessToken: string,
  item: ItemListing,
): Promise<void> {
  await withAuthenticatedClient(accessToken, (supabase, userId) =>
    listingsDb.insertListing(supabase, item, userId),
  );
}

export async function updateListingAction(
  accessToken: string,
  item: ItemListing,
): Promise<void> {
  await withAuthenticatedClient(accessToken, (supabase, userId) =>
    listingsDb.updateListing(supabase, item, userId),
  );
}

export async function deleteListingAction(
  accessToken: string,
  id: string,
): Promise<void> {
  await withAuthenticatedClient(accessToken, (supabase, userId) =>
    listingsDb.deleteListing(supabase, id, userId),
  );
}

export async function deleteAllListingsAction(accessToken: string): Promise<void> {
  await withAuthenticatedClient(accessToken, (supabase, userId) =>
    listingsDb.deleteAllListings(supabase, userId),
  );
}
