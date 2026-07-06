import { isPersistentImageUrl } from './utils/imageUrl';

// eBay listing conditions (with their eBay condition IDs)
export type EbayCondition =
  | 'New'
  | 'Like New'
  | 'Very Good'
  | 'Good'
  | 'Acceptable'
  | 'For Parts or Not Working';

export interface EbayConditionInfo {
  id: number;
  label: EbayCondition;
  description: string;
  mtgEquivalent: string;
}

export const EBAY_CONDITIONS: EbayConditionInfo[] = [
  { id: 1000, label: 'New',                     description: 'Brand new, sealed or never played', mtgEquivalent: 'Mint (M)' },
  { id: 2750, label: 'Like New',                description: 'Near perfect, no visible wear',     mtgEquivalent: 'Near Mint (NM)' },
  { id: 4000, label: 'Very Good',               description: 'Minor signs of use, fully playable', mtgEquivalent: 'Lightly Played (LP)' },
  { id: 5000, label: 'Good',                    description: 'Moderate wear, still fully playable', mtgEquivalent: 'Moderately Played (MP)' },
  { id: 6000, label: 'Acceptable',              description: 'Heavy wear, functional for play',    mtgEquivalent: 'Heavily Played (HP)' },
  { id: 7000, label: 'For Parts or Not Working', description: 'Damaged / not tournament legal',    mtgEquivalent: 'Damaged (DMG)' },
];

export type PricingMode = 'market' | 'percent_below' | 'manual';

/** Listing lookup lifecycle — mirrors public.item_status in Supabase. */
export const ITEM_STATUS = {
  Idle: 'idle',
  Searching: 'searching',
  Found: 'found',
  Ambiguous: 'ambiguous',
  NotFound: 'not_found',
} as const;

export type ItemStatus = typeof ITEM_STATUS[keyof typeof ITEM_STATUS];

export type MarketPriceSource =
  | 'ebay_completed'
  | 'upc_offers'
  | 'upc_recorded'
  | 'manual';

/** How to choose market price when both eBay and UPC data exist. */
export type MarketPricePreference = 'ebay' | 'upc' | 'show_all';

export interface MarketPriceOption {
  source: MarketPriceSource;
  price: number;
  priceRange?: PriceRange;
  soldCount?: number;
}

export interface PriceRange { low: number; high: number; }

export type ImageCandidateSource = 'upc_catalog' | 'ebay_sold' | 'user_upload' | 'user_photo';

export interface ImageCandidate {
  url: string;
  source: ImageCandidateSource;
}

/** MTG product resolved via UPC lookup and/or eBay market data. */
export interface Product {
  title: string;
  description: string;
  imageUrls: string[];
  imageCandidates?: ImageCandidate[];
  brand?: string;
  upc?: string;
  marketPrice?: number;
  marketPriceSource?: MarketPriceSource;
  /** All discovered market prices (eBay sold avg, UPC catalog, etc.). */
  marketPriceOptions?: MarketPriceOption[];
  priceRange?: PriceRange;
  soldCount?: number;
  ebaySearchUrl?: string;
  tcgplayerUrl?: string;
}

export interface ItemListing {
  id: string;
  /** Short human-readable ID for reference in exports and inventory (e.g. MTG-X7K2P9). */
  listingId: string;
  query: string;
  status: ItemStatus;

  // Original identifiers from import (preserved even when name is used for search)
  originalUpc?: string;
  originalSku?: string;

  // Resolved product from UPC/eBay lookup
  product?: Product;
  ambiguousResults?: Product[];

  /** User-edited listing title; overrides product.title when set. */
  customTitle?: string;

  /** User-edited listing description body; overrides product.description when set. */
  customDescription?: string;

  // ── User-set listing fields ──
  quantity: number;
  condition: EbayCondition | null;
  pricingMode: PricingMode;
  percentBelow: number;
  manualPrice: number;
  /** Which price source to use for market / % below pricing. */
  marketPricePreference?: MarketPricePreference;
  /** When preference is show_all, the source the user picked for this listing. */
  selectedMarketPriceSource?: MarketPriceSource;
  notes: string;

  // ── eBay tracking ──
  ebayExportedAt?: string;
  /** Marked live on eBay without exporting through this app. */
  listedExternally?: boolean;
  ebayListingStatus?: 'exported' | 'active' | 'sold' | 'ended';
  /** Live eBay listing URL (paste after listing goes active). */
  ebayListingUrl?: string;

  // ── Photo scan metadata ──
  photoUrl?: string;
  /** User-uploaded image URL (Supabase Storage public URL). */
  userImageUrl?: string;
  /** Which image to show on listings and export. */
  preferredImageSource?: 'catalog' | 'user';
  /** Product format detected from label OCR (e.g. Foil Promo Pack, Commander Deck). */
  detectedProductType?: string;
  /** Card count detected from label OCR (e.g. "3 Cards"). */
  detectedCardCount?: string;

  // ── Meta ──
  source: 'manual' | 'csv' | 'photo';
  createdAt: string;
}

export interface CSVRow {
  name?: string;
  sku?: string;
  upc?: string;
  set?: string;
  collector_number?: string;
  quantity?: string;
  condition?: string;
  notes?: string;
  price?: string;
}

export interface EbayListingPayload {
  title: string;
  description: string;
  primaryCategory: { categoryId: string };
  startPrice: number;
  conditionId: number;
  conditionDescription: string;
  quantity: number;
  pictureUrls: string[];
  itemSpecifics: Record<string, string>;
  listingType: 'FixedPriceItem';
  listingDuration: 'GTC';
  /** Cross-reference SKU included in export JSON — matches listingId. */
  sku?: string;
}

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
