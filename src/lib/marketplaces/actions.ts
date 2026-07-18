'use server';

import type { MarketplacePlatform, MarketplaceListings, UserItem } from '@/types';
import { WORKFLOW_STATUS } from '@/types';
import { withAuthenticatedClient } from '@/lib/auth/server';
import * as userItemsDb from '@/lib/db/userItems';
import * as connectionsDb from '@/lib/db/marketplaceConnections';
import { getAdapter, userItemToListInput } from '@/lib/marketplaces/types';
import { getValidMarketplaceToken } from '@/lib/marketplaces/tokenService';
import { encodeEbayAdapterToken } from '@/lib/marketplaces/ebay';
import type { EbaySellerDefaults } from '@/lib/marketplaces/ebay/oauth';
import { GUIDED_CONNECTION_TOKEN } from '@/lib/marketplaces/constants';

async function resolveAdapterToken(
  userId: string,
  platform: MarketplacePlatform,
): Promise<string | null> {
  const connection = await connectionsDb.fetchConnectionWithTokens(userId, platform);
  if (!connection) return null;

  if (connection.access_token === GUIDED_CONNECTION_TOKEN) {
    return null;
  }

  const token = await getValidMarketplaceToken(userId, platform);
  if (!token) return null;

  if (platform === 'ebay') {
    const sellerDefaults = (connection.metadata?.sellerDefaults ?? {}) as EbaySellerDefaults;
    return encodeEbayAdapterToken(token, sellerDefaults);
  }

  return token;
}

export async function listOnMarketplaceAction(
  accessToken: string,
  userItemId: string,
  platform: MarketplacePlatform,
): Promise<UserItem> {
  return withAuthenticatedClient(accessToken, async (supabase, userId) => {
    const item = await userItemsDb.fetchUserItem(supabase, userId, userItemId);
    if (!item) throw new Error('Item not found');
    if (item.workflowStatus !== WORKFLOW_STATUS.Ready) {
      throw new Error('Item must be Ready to export before listing');
    }

    const connection = await connectionsDb.fetchConnectionWithTokens(userId, platform);
    if (!connection && platform !== 'facebook') {
      throw new Error(`Connect your ${platform} account in Settings first`);
    }

    const adapterToken = await resolveAdapterToken(userId, platform);
    if (platform === 'ebay' && !adapterToken) {
      throw new Error('Connect your eBay account in Settings first');
    }

    const adapter = getAdapter(platform);
    const listing = await adapter.listItem(
      userItemToListInput(item),
      adapterToken ?? '',
    );

    const marketplaceListings: MarketplaceListings = {
      ...item.marketplaceListings,
      [platform]: listing,
    };

    const updated: UserItem = {
      ...item,
      marketplaceListings,
      workflowStatus: WORKFLOW_STATUS.Listed,
      targetPlatforms: [...new Set([...item.targetPlatforms, platform])],
      updatedAt: new Date().toISOString(),
    };

    await userItemsDb.updateUserItem(supabase, updated, userId);
    return updated;
  });
}

export async function syncMarketplaceStatusAction(
  accessToken: string,
  userItemId: string,
): Promise<UserItem> {
  return withAuthenticatedClient(accessToken, async (supabase, userId) => {
    const item = await userItemsDb.fetchUserItem(supabase, userId, userItemId);
    if (!item) throw new Error('Item not found');

    const marketplaceListings: MarketplaceListings = { ...item.marketplaceListings };
    let anySold = false;

    for (const platform of Object.keys(marketplaceListings) as MarketplacePlatform[]) {
      const listing = marketplaceListings[platform];
      if (!listing) continue;

      const adapterToken = await resolveAdapterToken(userId, platform);
      if (platform === 'ebay' && !adapterToken) continue;

      const adapter = getAdapter(platform);
      marketplaceListings[platform] = await adapter.syncListing(
        listing,
        adapterToken ?? '',
      );
      if (marketplaceListings[platform]?.status === 'sold') anySold = true;
    }

    const updated: UserItem = {
      ...item,
      marketplaceListings,
      workflowStatus: anySold ? WORKFLOW_STATUS.Sold : item.workflowStatus,
      updatedAt: new Date().toISOString(),
    };

    await userItemsDb.updateUserItem(supabase, updated, userId);
    return updated;
  });
}

export async function syncAllLiveItemsAction(accessToken: string): Promise<number> {
  return withAuthenticatedClient(accessToken, async (supabase, userId) => {
    const live = await userItemsDb.fetchUserItems(supabase, userId, WORKFLOW_STATUS.Listed);
    let count = 0;
    for (const item of live) {
      await syncMarketplaceStatusAction(accessToken, item.id);
      count++;
    }
    return count;
  });
}

export async function delistFromOtherPlatformsAction(
  accessToken: string,
  userItemId: string,
  soldOnPlatform: MarketplacePlatform,
): Promise<UserItem> {
  return withAuthenticatedClient(accessToken, async (supabase, userId) => {
    const item = await userItemsDb.fetchUserItem(supabase, userId, userItemId);
    if (!item) throw new Error('Item not found');

    const marketplaceListings: MarketplaceListings = { ...item.marketplaceListings };

    for (const platform of Object.keys(marketplaceListings) as MarketplacePlatform[]) {
      if (platform === soldOnPlatform) continue;
      const listing = marketplaceListings[platform];
      if (!listing || listing.status !== 'active') continue;

      const adapterToken = await resolveAdapterToken(userId, platform);
      if (platform === 'ebay' && !adapterToken) continue;

      const adapter = getAdapter(platform);
      marketplaceListings[platform] = await adapter.endListing(
        listing,
        adapterToken ?? '',
      );
    }

    const updated: UserItem = {
      ...item,
      marketplaceListings,
      workflowStatus: WORKFLOW_STATUS.Sold,
      updatedAt: new Date().toISOString(),
    };

    await userItemsDb.updateUserItem(supabase, updated, userId);
    return updated;
  });
}

export async function delistSoldFromOtherPlatformsAction(accessToken: string): Promise<number> {
  return withAuthenticatedClient(accessToken, async (supabase, userId) => {
    const sold = await userItemsDb.fetchUserItems(supabase, userId, WORKFLOW_STATUS.Sold);
    let count = 0;
    for (const item of sold) {
      const soldPlatform = (Object.keys(item.marketplaceListings) as MarketplacePlatform[]).find(
        p => item.marketplaceListings[p]?.status === 'sold',
      );
      if (soldPlatform) {
        await delistFromOtherPlatformsAction(accessToken, item.id, soldPlatform);
        count++;
      }
    }
    return count;
  });
}

export interface GuidedMarketplaceInput {
  sellerUrl?: string;
  sellerName?: string;
}

export async function connectGuidedMarketplaceAction(
  accessToken: string,
  platform: 'tcgplayer' | 'facebook',
  input?: GuidedMarketplaceInput,
): Promise<void> {
  await withAuthenticatedClient(accessToken, async (_supabase, userId) => {
    const metadata: Record<string, unknown> = { enabled: true, connectionType: 'guided' };
    if (input?.sellerUrl) metadata.sellerUrl = input.sellerUrl.trim();
    if (input?.sellerName) metadata.sellerName = input.sellerName.trim();

    const accountLabel =
      platform === 'facebook'
        ? 'Facebook Marketplace (guided)'
        : input?.sellerName?.trim() || 'TCGplayer (guided)';

    await connectionsDb.upsertConnection(userId, platform, {
      accessToken: GUIDED_CONNECTION_TOKEN,
      accountLabel,
      scopes: [],
      metadata,
    });
  });
}

export async function getEbayOAuthStartUrlAction(accessToken: string): Promise<string> {
  return withAuthenticatedClient(accessToken, async (_supabase, userId) => {
    const { buildEbayAuthorizationUrl } = await import('@/lib/marketplaces/ebay/oauth');
    const { createOAuthState } = await import('@/lib/oauth/state');
    const state = createOAuthState(userId, 'ebay');
    return buildEbayAuthorizationUrl(state);
  });
}
