import 'server-only';

import type { ListItemInput } from '../types';
import type { MarketplaceListing } from '@/types';
import { getEbayApiBaseUrl } from './config';
import type { EbaySellerDefaults } from './oauth';

const MTG_BOOSTER_CATEGORY = '183451';
const MTG_SEALED_CATEGORY = '183454';

const CONDITION_IDS: Record<string, string> = {
  'Near Mint': '1000',
  'Lightly Played': '3000',
  'Moderately Played': '3000',
  'Heavily Played': '3000',
  'Damaged': '3000',
  Good: '3000',
};

function detectCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('booster pack') || t.includes('draft pack') || t.includes('set booster')) {
    return MTG_BOOSTER_CATEGORY;
  }
  return MTG_SEALED_CATEGORY;
}

function sanitizeSku(referenceId: string): string {
  return referenceId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50);
}

function ebayHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Content-Language': 'en-US',
  };
}

async function ebayJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { errors?: Array<{ message: string }> };
  if (!response.ok) {
    const message = body.errors?.[0]?.message || `eBay API error (${response.status})`;
    throw new Error(message);
  }
  return body;
}

export async function createEbayListing(
  input: ListItemInput,
  accessToken: string,
  sellerDefaults: EbaySellerDefaults,
): Promise<MarketplaceListing> {
  const sku = sanitizeSku(input.referenceId);
  const categoryId = detectCategory(input.title);
  const conditionId = CONDITION_IDS[input.condition] ?? '1000';

  if (
    !sellerDefaults.fulfillmentPolicyId ||
    !sellerDefaults.paymentPolicyId ||
    !sellerDefaults.returnPolicyId ||
    !sellerDefaults.merchantLocationKey
  ) {
    throw new Error(
      'Your eBay account needs business policies and an inventory location. Set them up in eBay Seller Hub, then reconnect your account.',
    );
  }

  const inventoryPayload = {
    product: {
      title: input.title.slice(0, 80),
      description: input.description,
      imageUrls: input.imageUrls.slice(0, 12),
      aspects: {
        Game: ['Magic: The Gathering'],
        Condition: [input.condition],
      },
    },
    condition: conditionId,
    availability: {
      shipToLocationAvailability: { quantity: input.quantity },
    },
  };

  const inventoryResponse = await fetch(
    `${getEbayApiBaseUrl()}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
    {
      method: 'PUT',
      headers: ebayHeaders(accessToken),
      body: JSON.stringify(inventoryPayload),
    },
  );
  await ebayJson(inventoryResponse);

  const offerPayload = {
    sku,
    marketplaceId: 'EBAY_US',
    format: 'FIXED_PRICE',
    availableQuantity: input.quantity,
    categoryId,
    listingDescription: input.description,
    listingPolicies: {
      fulfillmentPolicyId: sellerDefaults.fulfillmentPolicyId,
      paymentPolicyId: sellerDefaults.paymentPolicyId,
      returnPolicyId: sellerDefaults.returnPolicyId,
    },
    merchantLocationKey: sellerDefaults.merchantLocationKey,
    pricingSummary: { price: { value: input.price.toFixed(2), currency: 'USD' } },
  };

  const offerResponse = await fetch(`${getEbayApiBaseUrl()}/sell/inventory/v1/offer`, {
    method: 'POST',
    headers: ebayHeaders(accessToken),
    body: JSON.stringify(offerPayload),
  });
  const offerBody = await ebayJson<{ offerId: string }>(offerResponse);

  const publishResponse = await fetch(
    `${getEbayApiBaseUrl()}/sell/inventory/v1/offer/${offerBody.offerId}/publish`,
    { method: 'POST', headers: ebayHeaders(accessToken) },
  );
  const publishBody = await ebayJson<{ listingId: string }>(publishResponse);

  const now = new Date().toISOString();
  return {
    listingId: publishBody.listingId,
    url: `https://www.ebay.com/itm/${publishBody.listingId}`,
    status: 'active',
    listedAt: now,
    lastSyncedAt: now,
  };
}

export async function syncEbayListing(
  listing: MarketplaceListing,
  accessToken: string,
): Promise<MarketplaceListing> {
  if (!listing.listingId) {
    return { ...listing, lastSyncedAt: new Date().toISOString() };
  }

  const response = await fetch(
    `${getEbayApiBaseUrl()}/sell/inventory/v1/offer?listing_ids=${encodeURIComponent(listing.listingId)}`,
    { headers: ebayHeaders(accessToken) },
  );
  const body = await ebayJson<{ offers?: Array<{ status: string }> }>(response);
  const offer = body.offers?.[0];
  const now = new Date().toISOString();

  if (!offer) {
    return { ...listing, status: 'ended', lastSyncedAt: now };
  }

  const status =
    offer.status === 'PUBLISHED' ? 'active' : offer.status === 'ENDED' ? 'ended' : listing.status;

  return { ...listing, status, lastSyncedAt: now };
}

export async function endEbayListing(
  listing: MarketplaceListing,
  accessToken: string,
): Promise<MarketplaceListing> {
  if (!listing.listingId) {
    return { ...listing, status: 'ended', lastSyncedAt: new Date().toISOString() };
  }

  const offersResponse = await fetch(
    `${getEbayApiBaseUrl()}/sell/inventory/v1/offer?listing_ids=${encodeURIComponent(listing.listingId)}`,
    { headers: ebayHeaders(accessToken) },
  );
  const offersBody = await ebayJson<{ offers?: Array<{ offerId: string }> }>(offersResponse);
  const offerId = offersBody.offers?.[0]?.offerId;

  if (offerId) {
    await fetch(`${getEbayApiBaseUrl()}/sell/inventory/v1/offer/${offerId}/withdraw`, {
      method: 'POST',
      headers: ebayHeaders(accessToken),
    });
  }

  return { ...listing, status: 'ended', lastSyncedAt: new Date().toISOString() };
}
