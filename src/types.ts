// ── Conditions ───────────────────────────────────────────────────────────────

export type ItemCondition =
  | 'New'
  | 'Like New'
  | 'Very Good'
  | 'Good'
  | 'Acceptable'
  | 'For Parts or Not Working';

export interface ConditionInfo {
  id: string;
  label: ItemCondition;
  description: string;
}

export const ITEM_CONDITIONS: ConditionInfo[] = [
  { id: 'new', label: 'New', description: 'Brand new, sealed or never used' },
  { id: 'like_new', label: 'Like New', description: 'Near perfect, no visible wear' },
  { id: 'very_good', label: 'Very Good', description: 'Minor signs of use' },
  { id: 'good', label: 'Good', description: 'Moderate wear, fully functional' },
  { id: 'acceptable', label: 'Acceptable', description: 'Heavy wear, still functional' },
  { id: 'for_parts', label: 'For Parts or Not Working', description: 'Damaged or not working' },
];

// ── Pricing ──────────────────────────────────────────────────────────────────

export type PricingMode = 'market' | 'percent_below' | 'manual';

export type PricingSource = 'amazon' | 'upc' | 'ebay' | 'tcgplayer' | 'manual';

export type MarketPricePreference = 'amazon' | 'upc' | 'show_all';

export type MarketPriceSource =
  | 'amazon_retail'
  | 'upc_offers'
  | 'upc_store'
  | 'upc_recorded'
  | 'ebay_completed'
  | 'tcgplayer_market'
  | 'manual';

export interface MarketPriceOption {
  /** Stable id for selection (e.g. amazon_retail, upc_store:ebay.com). Defaults to source. */
  id?: string;
  source: MarketPriceSource;
  price: number;
  priceRange?: PriceRange;
  soldCount?: number;
  /** Display name, e.g. "eBay.com" or "Walmart Marketplace". */
  label?: string;
  /** Deep link to the merchant listing / catalog page. */
  url?: string;
  /** ISO timestamp when the offer was last updated, if known. */
  updatedAt?: string;
}

export interface PriceRange {
  low: number;
  high: number;
}

// ── Workflow & lookup ────────────────────────────────────────────────────────

export const WORKFLOW_STATUS = {
  Draft: 'draft',
  Reviewed: 'reviewed',
  Ready: 'ready',
  Listed: 'listed',
  Sold: 'sold',
} as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUS)[keyof typeof WORKFLOW_STATUS];

export const LOOKUP_STATUS = {
  Idle: 'idle',
  Searching: 'searching',
  Found: 'found',
  Ambiguous: 'ambiguous',
  NotFound: 'not_found',
} as const;

export type LookupStatus = (typeof LOOKUP_STATUS)[keyof typeof LOOKUP_STATUS];

/** @deprecated Use LOOKUP_STATUS — kept for transitional imports */
export const ITEM_STATUS = LOOKUP_STATUS;
/** @deprecated Use LookupStatus */
export type ItemStatus = LookupStatus;

// ── Images ───────────────────────────────────────────────────────────────────

export type ImageCandidateSource =
  | 'amazon_catalog'
  | 'upc_catalog'
  | 'user_upload'
  | 'user_photo';

export type PreferredImageSource = 'catalog' | 'user';

export interface ImageCandidate {
  url: string;
  source: ImageCandidateSource;
}

// ── Catalog (communal items table) ───────────────────────────────────────────

export interface CatalogSnapshot {
  imageUrls?: string[];
  imageCandidates?: ImageCandidate[];
  amazonPrice?: number;
  upcPrice?: number;
  priceRange?: PriceRange;
  brand?: string;
  ambiguousResults?: CatalogSnapshot[];
  marketPriceOptions?: MarketPriceOption[];
}

export interface CatalogItem {
  id: string;
  upc: string | null;
  asin: string | null;
  title: string;
  description: string;
  defaultCategory: string | null;
  catalogSnapshot: CatalogSnapshot;
  lastFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Marketplaces ─────────────────────────────────────────────────────────────

export type MarketplacePlatform = 'ebay' | 'tcgplayer' | 'facebook';

export const MARKETPLACE_PLATFORMS: MarketplacePlatform[] = [
  'ebay',
  'tcgplayer',
  'facebook',
];

export const MARKETPLACE_LABELS: Record<MarketplacePlatform, string> = {
  ebay: 'eBay',
  tcgplayer: 'TCGPlayer',
  facebook: 'Facebook Marketplace',
};

export type MarketplaceListingStatus =
  | 'pending'
  | 'active'
  | 'sold'
  | 'ended'
  | 'error';

export interface MarketplaceListing {
  listingId?: string;
  url?: string;
  status: MarketplaceListingStatus;
  listedAt?: string;
  lastSyncedAt?: string;
  errorMessage?: string;
}

export type MarketplaceListings = Partial<Record<MarketplacePlatform, MarketplaceListing>>;

export interface MarketplaceConnection {
  id: string;
  userId: string;
  platform: MarketplacePlatform;
  connectedAt: string;
  expiresAt: string | null;
  accountLabel: string | null;
  isHealthy: boolean;
  metadata: Record<string, unknown>;
}

// ── User inventory (user_items table) ────────────────────────────────────────

export type ItemSource = 'manual' | 'csv' | 'photo';

export interface UserItem {
  id: string;
  userId: string;
  itemId: string | null;
  referenceId: string;
  query: string;
  customTitle: string | null;
  customDescription: string | null;
  quantity: number;
  condition: ItemCondition | null;
  price: number;
  /** @deprecated Derived cover image — prefer `imageUrls[0]`. Kept for UI helpers. */
  imageUrl: string | null;
  /** Ordered listing images selected by the user; first is the cover. */
  imageUrls: string[];
  category: string | null;
  workflowStatus: WorkflowStatus;
  lookupStatus: LookupStatus;
  pricingMode: PricingMode;
  percentBelow: number;
  pricingSource: PricingSource;
  selectedMarketPriceSource: string | null;
  marketplaceListings: MarketplaceListings;
  targetPlatforms: MarketplacePlatform[];
  originalUpc: string | null;
  originalSku: string | null;
  userImageUrl: string | null;
  photoUrl: string | null;
  preferredImageSource: PreferredImageSource | null;
  notes: string;
  source: ItemSource;
  createdAt: string;
  updatedAt: string;
}

/** User item joined with communal catalog data for display. */
export interface UserItemWithCatalog extends UserItem {
  catalog: CatalogItem | null;
}

// ── Product enrichment (transient API response) ────────────────────────────

export interface Product {
  title: string;
  description: string;
  imageUrls: string[];
  imageCandidates?: ImageCandidate[];
  brand?: string;
  upc?: string;
  asin?: string;
  marketPrice?: number;
  marketPriceSource?: MarketPriceSource;
  marketPriceOptions?: MarketPriceOption[];
  priceRange?: PriceRange;
  amazonSearchUrl?: string;
  /** @deprecated Marketplace URLs from connected accounts */
  ebaySearchUrl?: string;
  tcgplayerUrl?: string;
  soldCount?: number;
}

// ── Create / review payloads ─────────────────────────────────────────────────

export interface PricingCalculationInput {
  pricingMode: PricingMode;
  percentBelow: number;
  manualPrice: number;
}

export interface DefaultPricingDraft {
  manualPrice: number;
  pricingMode?: PricingMode;
  percentBelow?: number;
}

export type ReviewListingDefaults = Pick<
  UserItem,
  'quantity' | 'condition' | 'pricingMode' | 'percentBelow' | 'price'
>;

export type ListingCreatePayload = Pick<
  UserItem,
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
  | 'price'
  | 'pricingSource'
  | 'selectedMarketPriceSource'
  | 'category'
  | 'userImageUrl'
  | 'photoUrl'
  | 'preferredImageSource'
  | 'notes'
> & {
  itemId?: string | null;
  /** @deprecated Prefer selectedImageUrls */
  selectedImageUrl?: string;
  /** Ordered selected listing images; first is the cover. */
  selectedImageUrls?: string[];
  catalogSnapshot?: CatalogSnapshot;
  product?: Product;
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
  category?: string;
}

// ── Legacy aliases for gradual migration ─────────────────────────────────────

/** @deprecated Use UserItem */
export type ItemListing = UserItemWithCatalog;

export type EbayCondition = ItemCondition;

export const EBAY_CONDITIONS = ITEM_CONDITIONS.map(c => ({
  id: 0,
  label: c.label,
  description: c.description,
  mtgEquivalent: c.label,
}));

export const EBAY_LISTING_STATUS = {
  Exported: 'exported',
  Active: 'active',
  Sold: 'sold',
  Ended: 'ended',
} as const;

export type EbayListingStatus = (typeof EBAY_LISTING_STATUS)[keyof typeof EBAY_LISTING_STATUS];

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
  sku?: string;
}
