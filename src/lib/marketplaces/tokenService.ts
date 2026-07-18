import 'server-only';

import type { MarketplacePlatform } from '@/types';
import * as connectionsDb from '@/lib/db/marketplaceConnections';
import { isGuidedConnection, GUIDED_CONNECTION_TOKEN } from '@/lib/marketplaces/constants';
import { refreshEbayAccessToken } from '@/lib/marketplaces/ebay/oauth';

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export async function getValidMarketplaceToken(
  userId: string,
  platform: MarketplacePlatform,
): Promise<string | null> {
  const connection = await connectionsDb.fetchConnectionWithTokens(userId, platform);
  if (!connection) return null;

  if (isGuidedConnection(connection.access_token)) {
    return null;
  }

  if (!connection.is_healthy) {
    throw new Error(`Your ${platform} connection needs to be reconnected in Settings.`);
  }

  if (platform === 'ebay') {
    return getValidEbayToken(userId, connection);
  }

  return connection.access_token;
}

async function getValidEbayToken(
  userId: string,
  connection: connectionsDb.MarketplaceConnectionRow,
): Promise<string> {
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;
  const needsRefresh = expiresAt - Date.now() < REFRESH_BUFFER_MS;

  if (!needsRefresh) {
    return connection.access_token;
  }

  if (!connection.refresh_token) {
    await connectionsDb.markConnectionUnhealthy(userId, 'ebay');
    throw new Error('Your eBay connection expired. Please reconnect in Settings.');
  }

  try {
    const tokens = await refreshEbayAccessToken(connection.refresh_token);
    await connectionsDb.upsertConnection(userId, 'ebay', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? connection.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      accountLabel: connection.account_label,
      scopes: connection.scopes,
      metadata: connection.metadata,
      isHealthy: true,
    });
    return tokens.access_token;
  } catch (error) {
    await connectionsDb.markConnectionUnhealthy(userId, 'ebay');
    throw new Error(
      error instanceof Error
        ? `eBay token refresh failed: ${error.message}`
        : 'eBay token refresh failed. Please reconnect in Settings.',
    );
  }
}

export { GUIDED_CONNECTION_TOKEN, isGuidedConnection };
