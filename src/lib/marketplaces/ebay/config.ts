import 'server-only';

import { serverEnv } from '@/lib/env/server';

export type EbayEnvironment = 'sandbox' | 'production';

export function getEbayEnvironment(): EbayEnvironment {
  const env = serverEnv('EBAY_ENV').toLowerCase();
  return env === 'production' ? 'production' : 'sandbox';
}

export function isEbayConfigured(): boolean {
  return !!(
    serverEnv('EBAY_CLIENT_ID', 'EBAY_APP_ID') &&
    serverEnv('EBAY_CLIENT_SECRET') &&
    serverEnv('EBAY_RUNAME')
  );
}

export function getEbayClientId(): string {
  return serverEnv('EBAY_CLIENT_ID', 'EBAY_APP_ID');
}

export function getEbayClientSecret(): string {
  return serverEnv('EBAY_CLIENT_SECRET');
}

export function getEbayRuName(): string {
  return serverEnv('EBAY_RUNAME');
}

export const EBAY_SCOPES = [
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
];

export function getEbayAuthBaseUrl(env: EbayEnvironment = getEbayEnvironment()): string {
  return env === 'production'
    ? 'https://auth.ebay.com/oauth2/authorize'
    : 'https://auth.sandbox.ebay.com/oauth2/authorize';
}

export function getEbayTokenUrl(env: EbayEnvironment = getEbayEnvironment()): string {
  return env === 'production'
    ? 'https://api.ebay.com/identity/v1/oauth2/token'
    : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';
}

export function getEbayApiBaseUrl(env: EbayEnvironment = getEbayEnvironment()): string {
  return env === 'production' ? 'https://api.ebay.com' : 'https://api.sandbox.ebay.com';
}

export function getEbayIdentityBaseUrl(env: EbayEnvironment = getEbayEnvironment()): string {
  return env === 'production' ? 'https://apiz.ebay.com' : 'https://apiz.sandbox.ebay.com';
}
