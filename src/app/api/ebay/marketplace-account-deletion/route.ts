import { NextResponse } from 'next/server';
import * as connectionsDb from '@/lib/db/marketplaceConnections';
import { isAdminSupabaseConfigured } from '@/lib/supabase/admin';
import {
  buildEbayChallengeResponse,
  getEbayDeletionEndpointUrl,
  getEbayDeletionVerificationToken,
  isEbayDeletionEndpointConfigured,
  type EbayAccountDeletionPayload,
} from '@/lib/marketplaces/ebay/accountDeletion';

/**
 * eBay Marketplace Account Deletion / Closure Notifications
 * https://developer.ebay.com/marketplace-account-deletion
 *
 * GET  — challenge verification (required to unlock production keys)
 * POST — account deletion notice (remove stored eBay user data)
 */

export async function GET(request: Request) {
  const challengeCode = new URL(request.url).searchParams.get('challenge_code');

  if (!challengeCode) {
    return NextResponse.json(
      {
        ok: true,
        service: 'ebay-marketplace-account-deletion',
        endpoint: getEbayDeletionEndpointUrl(),
        configured: isEbayDeletionEndpointConfigured(),
      },
      { status: 200 },
    );
  }

  if (!getEbayDeletionVerificationToken()) {
    console.error('[ebay-deletion] EBAY_VERIFICATION_TOKEN is not set');
    return NextResponse.json({ error: 'verification_token_not_configured' }, { status: 500 });
  }

  try {
    const challengeResponse = buildEbayChallengeResponse(challengeCode);
    return NextResponse.json({ challengeResponse }, { status: 200 });
  } catch (err) {
    console.error('[ebay-deletion] challenge failed', err);
    return NextResponse.json({ error: 'challenge_failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Always acknowledge quickly — eBay retries on non-2xx.
  try {
    const body = (await request.json()) as EbayAccountDeletionPayload;
    const data = body.notification?.data;
    const ebayUserId = data?.userId?.trim();
    const username = data?.username?.trim();

    console.info('[ebay-deletion] notification', {
      notificationId: body.notification?.notificationId,
      topic: body.metadata?.topic,
      ebayUserId,
      username,
    });

    if (ebayUserId && isAdminSupabaseConfigured()) {
      const removed = await connectionsDb.deleteEbayConnectionsByEbayUserId(ebayUserId);
      console.info('[ebay-deletion] removed connections', { ebayUserId, removed });
    } else if (ebayUserId) {
      console.warn('[ebay-deletion] admin supabase not configured; cannot purge tokens', {
        ebayUserId,
      });
    }
  } catch (err) {
    console.error('[ebay-deletion] failed to process notification', err);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
