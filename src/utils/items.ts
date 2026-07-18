import type { CatalogItem, CatalogSnapshot, Product, UserItem, UserItemWithCatalog } from '../types';
import {
  LOOKUP_STATUS,
  WORKFLOW_STATUS,
  type LookupStatus,
  type WorkflowStatus,
} from '../types';
import { isPersistentImageUrl } from './images';

/** Generate a short, human-readable reference ID. */
export function generateReferenceId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]!;
  }
  return `MM-${suffix}`;
}

export function getDetectedTitle(item: UserItemWithCatalog): string {
  return item.catalog?.title ?? item.customTitle ?? item.query;
}

export function getItemTitle(item: UserItemWithCatalog): string {
  const custom = item.customTitle?.trim();
  if (custom) return custom;
  return item.catalog?.title?.trim() || item.query;
}

export function hasCustomTitle(item: UserItemWithCatalog): boolean {
  return !!item.customTitle?.trim();
}

export function getCatalogImageUrls(catalog: CatalogItem | null | undefined): string[] {
  if (!catalog) return [];
  const fromSnapshot = catalog.catalogSnapshot.imageUrls ?? [];
  const fromCandidates = (catalog.catalogSnapshot.imageCandidates ?? []).map(c => c.url);
  return [...fromSnapshot, ...fromCandidates];
}

export function getItemImageUrl(item: UserItemWithCatalog): string | null {
  const selected = (item.imageUrls ?? []).find(url => isPersistentImageUrl(url));
  if (selected) return selected;

  if (item.preferredImageSource === 'user') {
    const userUrl = item.userImageUrl ?? item.photoUrl;
    if (userUrl && isPersistentImageUrl(userUrl)) return userUrl;
    const catalogUrl = getCatalogImageUrls(item.catalog)[0];
    return catalogUrl ?? null;
  }

  const catalogUrl = getCatalogImageUrls(item.catalog)[0];
  if (catalogUrl) return catalogUrl;

  const fallback = item.userImageUrl ?? item.photoUrl;
  return fallback && isPersistentImageUrl(fallback) ? fallback : null;
}

/** Ordered listing images for an item — user selection first, then catalog fallbacks. */
export function getItemSelectedImageUrls(item: UserItemWithCatalog): string[] {
  const selected = (item.imageUrls ?? []).filter(url => isPersistentImageUrl(url));
  if (selected.length > 0) return selected;

  const primary = getItemImageUrl(item);
  return primary ? [primary] : [];
}

export function getItemPictureUrls(item: UserItemWithCatalog): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  const push = (url: string | null | undefined) => {
    if (!url || !isPersistentImageUrl(url) || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };

  const selected = (item.imageUrls ?? []).filter(url => isPersistentImageUrl(url));
  if (selected.length > 0) {
    for (const url of selected) {
      push(url);
    }
    return urls.slice(0, 12);
  }

  push(getItemImageUrl(item));
  if (item.preferredImageSource !== 'user') {
    push(item.userImageUrl);
  }
  for (const url of getCatalogImageUrls(item.catalog)) {
    push(url);
  }
  push(item.photoUrl);

  return urls.slice(0, 12);
}

export function itemHasListingImage(item: UserItemWithCatalog): boolean {
  return getItemPictureUrls(item).length > 0;
}

export function getItemListingDescription(item: UserItemWithCatalog): string {
  const custom = item.customDescription?.trim();
  if (custom) return custom;
  return item.catalog?.description?.trim() ?? '';
}

export function patchItemListingDescription(
  text: string,
): Pick<UserItem, 'customDescription'> {
  const trimmed = text.trim();
  return { customDescription: trimmed || null };
}
// --- itemStatus ---

export interface LookupStatusCounts {
  pending: number;
  found: number;
  ambiguous: number;
  notFound: number;
}

const ALL_LOOKUP_STATUSES: LookupStatus[] = Object.values(LOOKUP_STATUS);

export function isLookupStatus(value: string): value is LookupStatus {
  return (ALL_LOOKUP_STATUSES as string[]).includes(value);
}

/** @deprecated Use isLookupStatus */
export const isItemStatus = isLookupStatus;

export function isItemIdle(item: UserItemWithCatalog): boolean {
  return item.lookupStatus === LOOKUP_STATUS.Idle;
}

export function isItemSearching(item: UserItemWithCatalog): boolean {
  return item.lookupStatus === LOOKUP_STATUS.Searching;
}

export function isItemPending(item: UserItemWithCatalog): boolean {
  return isItemIdle(item) || isItemSearching(item);
}

export function isItemFound(item: UserItemWithCatalog): boolean {
  return item.lookupStatus === LOOKUP_STATUS.Found;
}

export function isItemAmbiguous(item: UserItemWithCatalog): boolean {
  return item.lookupStatus === LOOKUP_STATUS.Ambiguous;
}

export function isItemNotFound(item: UserItemWithCatalog): boolean {
  return item.lookupStatus === LOOKUP_STATUS.NotFound;
}

export function isItemFoundWithCatalog(item: UserItemWithCatalog): boolean {
  return isItemFound(item) && !!item.catalog;
}

export function isItemFoundMissingCondition(item: UserItemWithCatalog): boolean {
  return isItemFound(item) && !item.condition;
}

export function isItemNeedsAction(item: UserItemWithCatalog): boolean {
  return (
    isItemAmbiguous(item) ||
    isItemNotFound(item) ||
    isItemFoundMissingCondition(item)
  );
}

export function isItemDraftReady(item: UserItemWithCatalog): boolean {
  return (
    item.workflowStatus === WORKFLOW_STATUS.Draft &&
    isItemFound(item) &&
    !!item.condition &&
    item.price > 0
  );
}

export function findNextIdleItem(items: UserItemWithCatalog[]): UserItemWithCatalog | undefined {
  return items.find(i => isItemIdle(i) && !i.catalog);
}

export function lookupStatusFromMatch(hasCatalog: boolean): LookupStatus {
  return hasCatalog ? LOOKUP_STATUS.Found : LOOKUP_STATUS.NotFound;
}

/** @deprecated */
export const statusFromProductMatch = lookupStatusFromMatch;

export function countLookupStatuses(items: UserItemWithCatalog[]): LookupStatusCounts {
  return {
    pending: items.filter(isItemPending).length,
    found: items.filter(isItemFound).length,
    ambiguous: items.filter(isItemAmbiguous).length,
    notFound: items.filter(isItemNotFound).length,
  };
}

/** @deprecated */
export const countItemStatuses = countLookupStatuses;

export function getLookupStatusLabel(status: LookupStatus): string {
  switch (status) {
    case LOOKUP_STATUS.Found:
      return 'Ready to customize';
    case LOOKUP_STATUS.Ambiguous:
      return 'Multiple matches — select a product';
    case LOOKUP_STATUS.NotFound:
      return 'Not found online';
    case LOOKUP_STATUS.Idle:
    case LOOKUP_STATUS.Searching:
      return 'Searching…';
    default:
      return status;
  }
}

/** @deprecated */
export const getItemStatusLabel = getLookupStatusLabel;

export function hasConfirmedListingPrice(price: number | null | undefined): boolean {
  return typeof price === 'number' && Number.isFinite(price) && price > 0;
}

/** After modal confirm: reviewed only when price is set (unless forced draft). */
export function workflowAfterReviewConfirm(
  price: number | null | undefined,
  leaveAsDraft = false,
): WorkflowStatus {
  if (leaveAsDraft || !hasConfirmedListingPrice(price)) return WORKFLOW_STATUS.Draft;
  return WORKFLOW_STATUS.Reviewed;
}

export function getWorkflowStatusLabel(status: WorkflowStatus): string {
  switch (status) {
    case WORKFLOW_STATUS.Draft:
      return 'Draft';
    case WORKFLOW_STATUS.Reviewed:
      return 'Reviewed';
    case WORKFLOW_STATUS.Ready:
      return 'Ready to export';
    case WORKFLOW_STATUS.Listed:
      return 'Live';
    case WORKFLOW_STATUS.Sold:
      return 'Sold';
    default:
      return status;
  }
}

export function filterByWorkflow(
  items: UserItemWithCatalog[],
  status: WorkflowStatus,
): UserItemWithCatalog[] {
  return items.filter(i => i.workflowStatus === status);
}

export function isItemFoundWithProduct(item: UserItemWithCatalog): boolean {
  return isItemFoundWithCatalog(item);
}

export function isItemUnresolvedNotFound(item: UserItemWithCatalog): boolean {
  return isItemNotFound(item) && !item.catalog;
}

export function isItemUnresolvedAmbiguous(item: UserItemWithCatalog): boolean {
  return isItemAmbiguous(item) && !item.catalog;
}

export function filterLiveItems(items: UserItemWithCatalog[]): UserItemWithCatalog[] {
  return items.filter(
    i => i.workflowStatus === WORKFLOW_STATUS.Listed || i.workflowStatus === WORKFLOW_STATUS.Sold,
  );
}
// --- catalog ---

/** Map communal catalog data to a transient Product for review modals. */
export function catalogToProduct(
  catalog: CatalogItem | null | undefined,
  item?: UserItemWithCatalog,
): Product | null {
  if (!catalog) return null;

  const snapshot = catalog.catalogSnapshot;
  return {
    title: item?.customTitle ?? catalog.title,
    description: item?.customDescription ?? catalog.description,
    imageUrls: snapshot.imageUrls ?? [],
    imageCandidates: snapshot.imageCandidates,
    brand: snapshot.brand,
    upc: catalog.upc ?? item?.originalUpc ?? undefined,
    asin: catalog.asin ?? undefined,
    marketPrice: snapshot.amazonPrice ?? snapshot.upcPrice,
    marketPriceOptions: snapshot.marketPriceOptions,
    priceRange: snapshot.priceRange,
    amazonSearchUrl: catalog.asin
      ? `https://www.amazon.com/dp/${catalog.asin}`
      : `https://www.amazon.com/s?k=${encodeURIComponent(catalog.title)}`,
  };
}

export function getItemProduct(item: UserItemWithCatalog): Product | null {
  return catalogToProduct(item.catalog, item);
}

/** @deprecated Use item.referenceId */
export function getItemReferenceId(item: UserItemWithCatalog): string {
  return item.referenceId;
}

/** @deprecated Use item.price */
export function getItemManualPrice(item: UserItemWithCatalog): number {
  return item.price;
}

export function productToCatalogSnapshot(product: Product): CatalogSnapshot {
  return {
    imageUrls: product.imageUrls,
    imageCandidates: product.imageCandidates,
    amazonPrice: product.marketPriceOptions?.find(o => o.source === 'amazon_retail')?.price,
    upcPrice:
      product.marketPriceOptions?.find(o => o.source === 'upc_store')?.price ??
      product.marketPriceOptions?.find(o => o.source === 'upc_offers' || o.source === 'upc_recorded')
        ?.price,
    priceRange: product.priceRange,
    brand: product.brand,
    marketPriceOptions: product.marketPriceOptions,
  };
}
// --- product type ---

export function resolveItemProductType(item: UserItemWithCatalog): string | null {
  return item.category ?? item.catalog?.defaultCategory ?? null;
}

export function inferProductTypeFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('booster box')) return 'Booster Box';
  if (lower.includes('booster pack')) return 'Booster Pack';
  if (lower.includes('commander')) return 'Commander Deck';
  if (lower.includes('bundle')) return 'Bundle';
  if (lower.includes('sealed')) return 'Sealed Product';
  return null;
}
