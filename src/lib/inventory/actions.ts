'use server';

import type {
  CatalogSnapshot,
  MarketplacePlatform,
  UserItem,
  UserItemWithCatalog,
  WorkflowStatus,
} from '@/types';
import { withAuthenticatedClient } from '@/lib/auth/server';
import * as catalogDb from '@/lib/db/catalog';
import * as userItemsDb from '@/lib/db/userItems';
import * as connectionsDb from '@/lib/db/marketplaceConnections';
import type { ItemSource } from '@/types';

export async function fetchInventoryAction(
  accessToken: string,
  workflowStatus?: WorkflowStatus,
): Promise<UserItemWithCatalog[]> {
  return withAuthenticatedClient(accessToken, (supabase, userId) =>
    userItemsDb.fetchUserItems(supabase, userId, workflowStatus),
  );
}

export async function fetchUserItemAction(
  accessToken: string,
  id: string,
): Promise<UserItemWithCatalog | null> {
  return withAuthenticatedClient(accessToken, (supabase, userId) =>
    userItemsDb.fetchUserItem(supabase, userId, id),
  );
}

export async function createUserItemAction(
  accessToken: string,
  input: {
    query: string;
    source: ItemSource;
    overrides?: Partial<UserItem>;
    catalog?: {
      upc?: string | null;
      asin?: string | null;
      title: string;
      description: string;
      defaultCategory?: string | null;
      catalogSnapshot: CatalogSnapshot;
    };
  },
): Promise<UserItemWithCatalog> {
  return withAuthenticatedClient(accessToken, async (supabase, userId) => {
    let itemId: string | null = input.overrides?.itemId ?? null;

    if (input.catalog) {
      const catalogItem = await catalogDb.upsertCatalogItem(supabase, input.catalog);
      itemId = catalogItem.id;
    } else if (input.overrides?.originalUpc) {
      const existing = await catalogDb.findCatalogItemByUpc(supabase, input.overrides.originalUpc);
      if (existing) itemId = existing.id;
    }

    const item = userItemsDb.createDefaultUserItem(userId, input.query, input.source, {
      ...input.overrides,
      itemId,
    });

    await userItemsDb.insertUserItem(supabase, item, userId);
    const saved = await userItemsDb.fetchUserItem(supabase, userId, item.id);
    if (!saved) throw new Error('Failed to load saved item');
    return saved;
  });
}

export async function updateUserItemAction(
  accessToken: string,
  item: UserItem,
): Promise<void> {
  await withAuthenticatedClient(accessToken, (supabase, userId) =>
    userItemsDb.updateUserItem(supabase, item, userId),
  );
}

export async function deleteUserItemAction(
  accessToken: string,
  id: string,
): Promise<void> {
  await withAuthenticatedClient(accessToken, (supabase, userId) =>
    userItemsDb.deleteUserItem(supabase, id, userId),
  );
}

export async function deleteSoldUserItemsAction(accessToken: string): Promise<number> {
  return withAuthenticatedClient(accessToken, async (supabase, userId) => {
    const sold = await userItemsDb.fetchUserItems(supabase, userId, 'sold');
    for (const item of sold) {
      await userItemsDb.deleteUserItem(supabase, item.id, userId);
    }
    return sold.length;
  });
}

export async function upsertCatalogForUserItemAction(
  accessToken: string,
  userItemId: string,
  catalogInput: {
    upc?: string | null;
    asin?: string | null;
    title: string;
    description: string;
    defaultCategory?: string | null;
    catalogSnapshot: CatalogSnapshot;
  },
): Promise<UserItemWithCatalog> {
  return withAuthenticatedClient(accessToken, async (supabase, userId) => {
    const catalogItem = await catalogDb.upsertCatalogItem(supabase, catalogInput);
    const userItem = await userItemsDb.fetchUserItem(supabase, userId, userItemId);
    if (!userItem) throw new Error('Item not found');

    const updated: UserItem = {
      ...userItem,
      itemId: catalogItem.id,
      lookupStatus: 'found',
      updatedAt: new Date().toISOString(),
    };
    await userItemsDb.updateUserItem(supabase, updated, userId);
    const saved = await userItemsDb.fetchUserItem(supabase, userId, userItemId);
    if (!saved) throw new Error('Failed to reload item');
    return saved;
  });
}

export async function fetchMarketplaceConnectionsAction(accessToken: string) {
  return withAuthenticatedClient(accessToken, (supabase, userId) =>
    connectionsDb.fetchConnections(supabase, userId),
  );
}

export async function disconnectMarketplaceAction(
  accessToken: string,
  platform: MarketplacePlatform,
): Promise<void> {
  await withAuthenticatedClient(accessToken, (supabase, userId) =>
    connectionsDb.deleteConnection(supabase, userId, platform),
  );
}
