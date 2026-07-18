import { NextResponse } from 'next/server';
import * as connectionsDb from '@/lib/db/marketplaceConnections';
import { verifyOAuthState } from '@/lib/oauth/state';
import {
  exchangeEbayAuthorizationCode,
  fetchEbaySellerDefaults,
  fetchEbayUserIdentity,
  tokenExpiresAt,
} from '@/lib/marketplaces/ebay/oauth';
import { EBAY_SCOPES } from '@/lib/marketplaces/ebay/config';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const settingsUrl = new URL('/settings', request.url);

  if (error) {
    settingsUrl.searchParams.set('oauth_error', error);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state) {
    settingsUrl.searchParams.set('oauth_error', 'missing_code');
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const { userId } = verifyOAuthState(state, 'ebay');
    const tokens = await exchangeEbayAuthorizationCode(code);
    const identity = await fetchEbayUserIdentity(tokens.access_token);
    const sellerDefaults = await fetchEbaySellerDefaults(tokens.access_token);

    await connectionsDb.upsertConnection(userId, 'ebay', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: tokenExpiresAt(tokens.expires_in),
      accountLabel: identity.username,
      scopes: EBAY_SCOPES,
      metadata: {
        connectionType: 'oauth',
        ebayUserId: identity.userId,
        sellerDefaults,
      },
      isHealthy: true,
    });

    settingsUrl.searchParams.set('connected', 'ebay');
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    settingsUrl.searchParams.set('oauth_error', message);
    return NextResponse.redirect(settingsUrl);
  }
}
