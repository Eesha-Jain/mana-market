import type { UserItemWithCatalog, EbayListingPayload } from '../types';
import { EBAY_CONDITIONS, LOOKUP_STATUS, WORKFLOW_STATUS } from '../types';
import {
  getItemTitle,
  getItemListingDescription,
  getItemPictureUrls,
  getItemProduct,
  isItemFound,
} from './items';
import { isItemListingLocked } from './listingLock';
import { resolveItemMarketPrice } from './marketPrice';
import { resolveItemProductType } from './productType';
import { calculateDraftPrice } from './pricing';

const MTG_BOOSTER_CATEGORY = '183451';
const MTG_SEALED_CATEGORY = '183454';

function detectCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('booster pack') || t.includes('draft pack') || t.includes('set booster')) {
    return MTG_BOOSTER_CATEGORY;
  }
  if (
    t.includes('booster box') ||
    t.includes('bundle') ||
    t.includes('commander deck') ||
    t.includes('prerelease') ||
    t.includes('fat pack') ||
    t.includes('gift box') ||
    t.includes('starter kit') ||
    t.includes('jumpstart')
  ) {
    return MTG_SEALED_CATEGORY;
  }
  return MTG_SEALED_CATEGORY;
}

export function getItemMarketPrice(item: UserItemWithCatalog): number | null {
  return resolveItemMarketPrice(item);
}

export function calculatePrice(item: UserItemWithCatalog): number | null {
  return calculateDraftPrice(getItemMarketPrice(item), {
    pricingMode: item.pricingMode,
    percentBelow: item.percentBelow,
    manualPrice: item.price,
  });
}

function buildListingTitle(item: UserItemWithCatalog): string {
  const title = getItemTitle(item);
  if (!item.condition) return title.slice(0, 80);

  const withCondition = `${title} - ${item.condition} MTG`;
  return withCondition.length > 80 ? withCondition.slice(0, 77) + '...' : withCondition;
}

function buildDescription(item: UserItemWithCatalog): string {
  const p = getItemProduct(item);
  const displayTitle = getItemTitle(item);
  const descriptionBody = getItemListingDescription(item) || p?.description || '';
  if (!p) {
    const parts = [`<p>${displayTitle}</p>`];
    if (descriptionBody) parts.push(`<p>${descriptionBody.replace(/\n/g, '<br/>')}</p>`);
    return parts.join('\n');
  }

  const lines = [
    `<h2>${displayTitle}</h2>`,
    descriptionBody ? `<p>${descriptionBody.replace(/\n/g, '<br/>')}</p>` : '',
    p.brand ? `<p><strong>Brand:</strong> ${p.brand}</p>` : '',
    `<hr/>`,
    `<p><strong>Condition:</strong> ${item.condition}</p>`,
    p.upc ? `<p><strong>UPC:</strong> ${p.upc}</p>` : '',
    `<p>Ships securely packaged. From a smoke-free collection.</p>`,
  ];

  return lines.filter(Boolean).join('\n');
}

function buildItemSpecifics(item: UserItemWithCatalog): Record<string, string> {
  const p = getItemProduct(item);
  if (!p) return {};

  const titleLower = p.title.toLowerCase();
  const productType =
    resolveItemProductType(item) ??
    (titleLower.includes('booster pack')
      ? 'Booster Pack'
      : titleLower.includes('booster box')
        ? 'Booster Box'
        : titleLower.includes('commander')
          ? 'Commander Deck'
          : titleLower.includes('bundle')
            ? 'Bundle'
            : 'Sealed Product');

  return {
    Game: 'Magic: The Gathering',
    Brand: p.brand || 'Wizards of the Coast',
    Condition: item.condition ?? '',
    Type: productType,
    ...(p.upc ? { UPC: p.upc } : {}),
  };
}

export function isItemReady(item: UserItemWithCatalog): boolean {
  if (!isItemFound(item) || !item.condition || calculatePrice(item) === null) {
    return false;
  }
  return !!getItemProduct(item);
}

export function isItemOnEbay(item: UserItemWithCatalog): boolean {
  return !!item.marketplaceListings?.ebay || isItemListingLocked(item);
}

/** Live eBay listing URL from marketplace export, when set. */
export function getEbayListingUrl(item: UserItemWithCatalog): string | null {
  const url = item.marketplaceListings?.ebay?.url?.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

export const EBAY_SELLER_ACTIVE_LISTINGS_URL = 'https://www.ebay.com/sh/lst/active';

export function buildEbayListing(item: UserItemWithCatalog): EbayListingPayload | null {
  const product = getItemProduct(item);
  if (!isItemFound(item) || !item.condition || !product) return null;

  const price = calculatePrice(item);
  if (price === null) return null;

  const conditionInfo = EBAY_CONDITIONS.find(c => c.label === item.condition) ?? null;
  if (!conditionInfo) return null;

  return {
    title: buildListingTitle(item),
    description: buildDescription(item),
    primaryCategory: { categoryId: detectCategory(product.title) },
    startPrice: price,
    conditionId: conditionInfo.id,
    conditionDescription: item.condition,
    quantity: item.quantity,
    pictureUrls: getItemPictureUrls(item),
    itemSpecifics: buildItemSpecifics(item),
    listingType: 'FixedPriceItem',
    listingDuration: 'GTC',
    sku: item.referenceId,
  };
}

export function getExportableItems(items: UserItemWithCatalog[]): UserItemWithCatalog[] {
  return items.filter(
    item =>
      isItemReady(item) &&
      !isItemOnEbay(item) &&
      item.workflowStatus === WORKFLOW_STATUS.Ready &&
      item.lookupStatus === LOOKUP_STATUS.Found,
  );
}

export function exportListingsJSON(items: UserItemWithCatalog[]): string {
  const payloads = items
    .filter(isItemReady)
    .filter(item => !isItemOnEbay(item))
    .map(buildEbayListing)
    .filter((payload): payload is EbayListingPayload => payload !== null);

  return JSON.stringify(payloads, null, 2);
}
