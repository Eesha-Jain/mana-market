import { NextResponse } from 'next/server';
import { readBearerToken, verifyAccessToken } from '@/lib/auth/server';
import { buildEbayAuthorizationUrl } from '@/lib/marketplaces/ebay/oauth';
import { isEbayConfigured } from '@/lib/marketplaces/ebay/config';
import { createOAuthState } from '@/lib/oauth/state';

export async function GET(request: Request) {
  if (!isEbayConfigured()) {
    return NextResponse.json({ error: 'eBay is not configured' }, { status: 503 });
  }

  const token = readBearerToken(request) ?? new URL(request.url).searchParams.get('token');
  const userId = await verifyAccessToken(token);
  if (!userId) {
    return NextResponse.redirect(new URL('/login?next=/settings', request.url));
  }

  const state = createOAuthState(userId, 'ebay');
  const authUrl = buildEbayAuthorizationUrl(state);
  return NextResponse.redirect(authUrl);
}
