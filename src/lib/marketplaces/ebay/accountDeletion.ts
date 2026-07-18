import 'server-only';

import { createHash } from 'node:crypto';
import { serverEnv } from '@/lib/env/server';

/** Default production URL for mana-market on Vercel. Override with EBAY_DELETION_ENDPOINT_URL. */
const DEFAULT_DELETION_ENDPOINT =
  'https://mana-market-eta.vercel.app/api/ebay/marketplace-account-deletion';

export function getEbayDeletionVerificationToken(): string {
  return serverEnv('EBAY_VERIFICATION_TOKEN', 'EBAY_DELETION_VERIFICATION_TOKEN');
}

/**
 * Exact URL registered in the eBay Developer Portal.
 * Must match character-for-character — trailing slashes, http vs https, domain, path.
 */
export function getEbayDeletionEndpointUrl(): string {
  return serverEnv('EBAY_DELETION_ENDPOINT_URL') || DEFAULT_DELETION_ENDPOINT;
}

export function isEbayDeletionEndpointConfigured(): boolean {
  return !!getEbayDeletionVerificationToken();
}

/** SHA-256 hex of challengeCode + verificationToken + endpointUrl (eBay-required order). */
export function buildEbayChallengeResponse(challengeCode: string): string {
  const token = getEbayDeletionVerificationToken();
  if (!token) {
    throw new Error('EBAY_VERIFICATION_TOKEN is not set');
  }

  return createHash('sha256')
    .update(challengeCode)
    .update(token)
    .update(getEbayDeletionEndpointUrl())
    .digest('hex');
}

export interface EbayAccountDeletionPayload {
  metadata?: { topic?: string };
  notification?: {
    notificationId?: string;
    data?: {
      username?: string;
      userId?: string;
      eiasToken?: string;
    };
  };
}
