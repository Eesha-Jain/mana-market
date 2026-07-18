import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env/server';

const STATE_TTL_MS = 10 * 60 * 1000;

interface OAuthStatePayload {
  userId: string;
  platform: string;
  nonce: string;
  exp: number;
}

function getStateSecret(): string {
  const secret = serverEnv('OAUTH_STATE_SECRET', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) {
    throw new Error('OAUTH_STATE_SECRET or SUPABASE_SERVICE_ROLE_KEY is required for OAuth.');
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', getStateSecret()).update(payload).digest('base64url');
}

export function createOAuthState(userId: string, platform: string): string {
  const payload: OAuthStatePayload = {
    userId,
    platform,
    nonce: randomBytes(16).toString('hex'),
    exp: Date.now() + STATE_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function verifyOAuthState(state: string, expectedPlatform: string): OAuthStatePayload {
  const [encoded, signature] = state.split('.');
  if (!encoded || !signature) {
    throw new Error('Invalid OAuth state.');
  }

  const expectedSig = sign(encoded);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid OAuth state signature.');
  }

  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OAuthStatePayload;
  if (payload.platform !== expectedPlatform) {
    throw new Error('OAuth state platform mismatch.');
  }
  if (Date.now() > payload.exp) {
    throw new Error('OAuth state expired. Please try connecting again.');
  }

  return payload;
}
