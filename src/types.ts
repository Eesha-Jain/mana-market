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

/** Which hero image to show when both catalog and user uploads exist. */
export type PreferredImageSource = 'catalog' | 'user';

/** How the listing entered the app. */
export type ItemSource = 'manual' | 'csv' | 'photo';

export const EBAY_LISTING_STATUS = {
  Exported: 'exported',
  Active: 'active',
  Sold: 'sold',
  Ended: 'ended',
} as const;

export type EbayListingStatus = typeof EBAY_LISTING_STATUS[keyof typeof EBAY_LISTING_STATUS];

export interface ImageCandidate {
  url: string;
  source: ImageCandidateSource;
}

/** Resolved pricing fields used by calculateDraftPrice. */
export interface PricingCalculationInput {
  pricingMode: PricingMode;
  percentBelow: number;
  manualPrice: number;
}

/** Partial pricing from import before user defaults are applied. */
export interface DefaultPricingDraft {
  manualPrice: number;
  pricingMode?: PricingMode;
  percentBelow?: number;
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
  ebayListingStatus?: EbayListingStatus;
  /** Live eBay listing URL (paste after listing goes active). */
  ebayListingUrl?: string;

  // ── Photo scan metadata ──
  photoUrl?: string;
  /** User-uploaded image URL (Supabase Storage public URL). */
  userImageUrl?: string;
  /** Which image to show on listings and export. */
  preferredImageSource?: PreferredImageSource;
  /** Product format detected from label OCR (e.g. Foil Promo Pack, Commander Deck). */
  detectedProductType?: string;
  /** Card count detected from label OCR (e.g. "3 Cards"). */
  detectedCardCount?: string;

  // ── Meta ──
  source: ItemSource;
  createdAt: string;
}

/** Initial listing fields shown in review dialogs before save. */
export type ReviewListingDefaults = Pick<
  ItemListing,
  'quantity' | 'condition' | 'pricingMode' | 'percentBelow' | 'manualPrice'
>;

/** Fields collected when confirming a review flow — derived from ItemListing. */
export type ListingCreatePayload = Pick<
  ItemListing,
  | 'query'
  | 'source'
  | 'customTitle'
  | 'customDescription'
  | 'originalUpc'
  | 'originalSku'
  | 'quantity'
  | 'condition'
  | 'pricingMode'
  | 'percentBelow'
  | 'manualPrice'
  | 'marketPricePreference'
  | 'selectedMarketPriceSource'
  | 'product'
  | 'photoUrl'
  | 'userImageUrl'
  | 'preferredImageSource'
> & {
  selectedImageUrl?: string;
  parseMeta?: {
    packType?: string;
    cardCount?: string;
  };
};

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

export {
  generateListingId,
  getDetectedTitle,
  getItemTitle,
  hasCustomTitle,
  getItemImageUrl,
  getItemPictureUrls,
  itemHasListingImage,
  getItemListingDescription,
  patchItemListingDescription,
} from './utils/itemListing';
