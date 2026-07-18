import 'server-only';

import {
  EBAY_SCOPES,
  getEbayApiBaseUrl,
  getEbayAuthBaseUrl,
  getEbayClientId,
  getEbayClientSecret,
  getEbayEnvironment,
  getEbayIdentityBaseUrl,
  getEbayRuName,
  getEbayTokenUrl,
  isEbayConfigured,
} from './config';

export interface EbayTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface EbayUserIdentity {
  username: string;
  userId: string;
}

export interface EbaySellerDefaults {
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  merchantLocationKey?: string;
}

function getBasicAuthHeader(): string {
  const credentials = `${getEbayClientId()}:${getEbayClientSecret()}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

export function buildEbayAuthorizationUrl(state: string): string {
  if (!isEbayConfigured()) {
    throw new Error('eBay is not configured. Set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, and EBAY_RUNAME.');
  }

  const params = new URLSearchParams({
    client_id: getEbayClientId(),
    redirect_uri: getEbayRuName(),
    response_type: 'code',
    scope: EBAY_SCOPES.join(' '),
    state,
  });

  return `${getEbayAuthBaseUrl()}?${params.toString()}`;
}

async function parseTokenResponse(response: Response): Promise<EbayTokenResponse> {
  const body = (await response.json()) as EbayTokenResponse & { error?: string; error_description?: string };
  if (!response.ok) {
    throw new Error(body.error_description || body.error || 'eBay token request failed');
  }
  return body;
}

export async function exchangeEbayAuthorizationCode(code: string): Promise<EbayTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getEbayRuName(),
  });

  const response = await fetch(getEbayTokenUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: getBasicAuthHeader(),
    },
    body: params.toString(),
  });

  return parseTokenResponse(response);
}

export async function refreshEbayAccessToken(refreshToken: string): Promise<EbayTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: EBAY_SCOPES.join(' '),
  });

  const response = await fetch(getEbayTokenUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: getBasicAuthHeader(),
    },
    body: params.toString(),
  });

  return parseTokenResponse(response);
}

export async function fetchEbayUserIdentity(accessToken: string): Promise<EbayUserIdentity> {
  const response = await fetch(`${getEbayIdentityBaseUrl()}/commerce/identity/v1/user/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = (await response.json()) as { username?: string; userId?: string; errors?: { message: string }[] };
  if (!response.ok) {
    const message = body.errors?.[0]?.message || 'Failed to fetch eBay user identity';
    throw new Error(message);
  }

  return {
    username: body.username ?? 'eBay seller',
    userId: body.userId ?? '',
  };
}

async function fetchFirstPolicyId(
  accessToken: string,
  endpoint: string,
  listKey: string,
  idField: string,
): Promise<string | undefined> {
  const response = await fetch(`${getEbayApiBaseUrl()}${endpoint}?marketplace_id=EBAY_US`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return undefined;

  const body = (await response.json()) as Record<string, Array<Record<string, string>>>;
  const list = body[listKey];
  if (!Array.isArray(list) || list.length === 0) return undefined;
  return list[0]?.[idField];
}

export async function fetchEbaySellerDefaults(accessToken: string): Promise<EbaySellerDefaults> {
  const [fulfillmentPolicyId, paymentPolicyId, returnPolicyId, locationKey] = await Promise.all([
    fetchFirstPolicyId(
      accessToken,
      '/sell/account/v1/fulfillment_policy',
      'fulfillmentPolicies',
      'fulfillmentPolicyId',
    ),
    fetchFirstPolicyId(
      accessToken,
      '/sell/account/v1/payment_policy',
      'paymentPolicies',
      'paymentPolicyId',
    ),
    fetchFirstPolicyId(
      accessToken,
      '/sell/account/v1/return_policy',
      'returnPolicies',
      'returnPolicyId',
    ),
    fetchMerchantLocationKey(accessToken),
  ]);

  return {
    fulfillmentPolicyId,
    paymentPolicyId,
    returnPolicyId,
    merchantLocationKey: locationKey,
  };
}

async function fetchMerchantLocationKey(accessToken: string): Promise<string | undefined> {
  const response = await fetch(`${getEbayApiBaseUrl()}/sell/inventory/v1/location?limit=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return undefined;

  const body = (await response.json()) as { locations?: Array<{ merchantLocationKey?: string }> };
  return body.locations?.[0]?.merchantLocationKey;
}

export function tokenExpiresAt(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export function getEbayEnvironmentName(): string {
  return getEbayEnvironment();
}
