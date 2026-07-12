import type { ItemListing } from '../types';
import { isPersistentImageUrl } from './imageUrl';

/** Generate a short, human-readable listing ID. */
export function generateListingId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]!;
  }
  return `MTG-${suffix}`;
}

/** Title detected from lookup (unchanged by user edits). */
export function getDetectedTitle(item: ItemListing): string {
  return item.product?.title ?? item.query;
}

/** Display / export title — uses customTitle when the user has overridden it. */
export function getItemTitle(item: ItemListing): string {
  const custom = item.customTitle?.trim();
  if (custom) return custom;
  return getDetectedTitle(item);
}

/** Whether the user has customized the listing title. */
export function hasCustomTitle(item: ItemListing): boolean {
  return !!item.customTitle?.trim();
}

/** Primary product image URL, if any (persistent HTTP/S only). */
export function getItemImageUrl(item: ItemListing): string | null {
  if (item.preferredImageSource === 'user') {
    const userUrl = item.userImageUrl ?? item.photoUrl;
    if (userUrl && isPersistentImageUrl(userUrl)) return userUrl;
    return item.product?.imageUrls[0] ?? null;
  }
  if (item.product?.imageUrls[0]) return item.product.imageUrls[0];
  const fallback = item.userImageUrl ?? item.photoUrl;
  return fallback && isPersistentImageUrl(fallback) ? fallback : null;
}

/** All picture URLs for eBay export (selected image first, then catalog alternates). */
export function getItemPictureUrls(item: ItemListing): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  const push = (url: string | null | undefined) => {
    if (!url || !isPersistentImageUrl(url) || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };

  push(getItemImageUrl(item));
  if (item.preferredImageSource !== 'user') {
    push(item.userImageUrl);
  }
  for (const url of item.product?.imageUrls ?? []) {
    push(url);
  }
  push(item.photoUrl);

  return urls.slice(0, 12);
}

export function itemHasListingImage(item: ItemListing): boolean {
  return getItemPictureUrls(item).length > 0;
}

/** Listing description shown in the UI and eBay export. */
export function getItemListingDescription(item: ItemListing): string {
  return item.customDescription?.trim() ?? '';
}

/** Persist a user-edited listing description. */
export function patchItemListingDescription(text: string): Pick<ItemListing, 'customDescription'> {
  const trimmed = text.trim();
  return { customDescription: trimmed || undefined };
}
