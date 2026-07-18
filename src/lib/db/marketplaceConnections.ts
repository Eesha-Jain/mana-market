import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MarketplaceConnection, MarketplacePlatform } from '@/types';
import { createAdminSupabase } from '@/lib/supabase/admin';

export interface MarketplaceConnectionRow {
  id: string;
  user_id: string;
  platform: MarketplacePlatform;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  account_label: string | null;
  scopes: string[];
  is_healthy: boolean;
  metadata: Record<string, unknown>;
  connected_at: string;
  updated_at: string;
}

function assertNoError(error: { message?: string } | null, operation: string): void {
  if (error) {
    console.error(`[supabase] ${operation}`, error);
    throw new Error(error.message || `Failed to ${operation}`);
  }
}

export function rowToConnection(row: {
  id: string;
  user_id: string;
  platform: MarketplacePlatform;
  token_expires_at: string | null;
  account_label: string | null;
  is_healthy: boolean;
  metadata?: Record<string, unknown>;
  connected_at: string;
}): MarketplaceConnection {
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform,
    connectedAt: row.connected_at,
    expiresAt: row.token_expires_at,
    accountLabel: row.account_label,
    isHealthy: row.is_healthy,
    metadata: row.metadata ?? {},
  };
}

/** Client-safe list — no OAuth tokens. */
export async function fetchConnections(
  supabase: SupabaseClient,
  userId: string,
): Promise<MarketplaceConnection[]> {
  const { data, error } = await supabase
    .from('marketplace_connections_public')
    .select('id, user_id, platform, token_expires_at, account_label, is_healthy, metadata, connected_at')
    .eq('user_id', userId);

  if (error) {
    console.error('[supabase] fetchConnections', error);
    throw error;
  }

  return (data ?? []).map(row => rowToConnection(row as MarketplaceConnectionRow));
}

/** Server-only — loads OAuth tokens via service role. */
export async function fetchConnectionWithTokens(
  userId: string,
  platform: MarketplacePlatform,
): Promise<MarketplaceConnectionRow | null> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from('marketplace_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform)
    .maybeSingle();

  if (error) {
    console.error('[supabase] fetchConnectionWithTokens', error);
    throw error;
  }

  return data as MarketplaceConnectionRow | null;
}

/** Server-only — upsert tokens and metadata via service role. */
export async function upsertConnection(
  userId: string,
  platform: MarketplacePlatform,
  tokens: {
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: string | null;
    accountLabel?: string | null;
    scopes?: string[];
    metadata?: Record<string, unknown>;
    isHealthy?: boolean;
  },
): Promise<void> {
  const admin = createAdminSupabase();
  const { error } = await admin.from('marketplace_connections').upsert(
    {
      user_id: userId,
      platform,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken ?? null,
      token_expires_at: tokens.expiresAt ?? null,
      account_label: tokens.accountLabel ?? null,
      scopes: tokens.scopes ?? [],
      metadata: tokens.metadata ?? {},
      is_healthy: tokens.isHealthy ?? true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,platform' },
  );
  assertNoError(error, 'upsert marketplace connection');
}

export async function markConnectionUnhealthy(
  userId: string,
  platform: MarketplacePlatform,
): Promise<void> {
  const admin = createAdminSupabase();
  const { error } = await admin
    .from('marketplace_connections')
    .update({ is_healthy: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('platform', platform);
  assertNoError(error, 'mark marketplace connection unhealthy');
}

export async function deleteConnection(
  supabase: SupabaseClient,
  userId: string,
  platform: MarketplacePlatform,
): Promise<void> {
  const { error } = await supabase
    .from('marketplace_connections')
    .delete()
    .eq('user_id', userId)
    .eq('platform', platform);
  assertNoError(error, 'delete marketplace connection');
}

/**
 * Removes eBay OAuth connections for a closed eBay account (marketplace deletion notification).
 * Matches metadata.ebayUserId written during OAuth callback.
 */
export async function deleteEbayConnectionsByEbayUserId(ebayUserId: string): Promise<number> {
  if (!ebayUserId.trim()) return 0;

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from('marketplace_connections')
    .select('id, metadata')
    .eq('platform', 'ebay');

  assertNoError(error, 'list ebay connections for deletion');

  const ids = (data ?? [])
    .filter(row => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      return String(meta.ebayUserId ?? '') === ebayUserId;
    })
    .map(row => row.id as string);

  if (ids.length === 0) return 0;

  const { error: deleteError } = await admin
    .from('marketplace_connections')
    .delete()
    .in('id', ids);

  assertNoError(deleteError, 'delete ebay connections by ebay user id');
  return ids.length;
}
