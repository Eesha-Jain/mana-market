import type { PricingMode, MarketPricePreference } from '../types';
import type { TextCaseFormat } from './textCase';
import { normalizeTextCaseFormat } from './textCase';

/** What part of the product to photograph during photo scan. */
export type PhotoCaptureTarget = 'upc' | 'label';

export type UserSettingKey =
  | 'photoCaptureTarget'
  | 'titleCase'
  | 'descriptionCase'
  | 'pricingMode'
  | 'percentBelow'
  | 'marketPriceSource';

export interface UserSettings {
  /** null = user has not chosen a default — prompt on each photo scan. */
  defaultPhotoCaptureTarget: PhotoCaptureTarget | null;
  defaultTitleCase: TextCaseFormat;
  defaultDescriptionCase: TextCaseFormat;
  defaultPricingMode: PricingMode;
  defaultPercentBelow: number;
  defaultMarketPricePreference: MarketPricePreference;
  /** Which defaults the user has explicitly saved (via Settings or "save as default" prompts). */
  configuredDefaults: Partial<Record<UserSettingKey, true>>;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  defaultPhotoCaptureTarget: null,
  defaultTitleCase: 'as_detected',
  defaultDescriptionCase: 'as_detected',
  defaultPricingMode: 'market',
  defaultPercentBelow: 10,
  defaultMarketPricePreference: 'ebay',
  configuredDefaults: {},
};

export const MARKET_PRICE_PREFERENCE_OPTIONS: {
  value: MarketPricePreference;
  label: string;
  description: string;
}[] = [
  {
    value: 'ebay',
    label: 'eBay sold listings',
    description: 'Use the average from recent eBay sold listings.',
  },
  {
    value: 'upc',
    label: 'UPC catalog',
    description: 'Use merchant offers or recorded catalog price from the UPC database.',
  },
  {
    value: 'show_all',
    label: 'Show all (pick per item)',
    description: 'Show every available price and choose which one to use on each listing.',
  },
];

export const PHOTO_CAPTURE_TARGET_OPTIONS: {
  value: PhotoCaptureTarget;
  label: string;
  shortLabel: string;
  description: string;
  recommended?: boolean;
}[] = [
  {
    value: 'upc',
    label: 'UPC barcode',
    shortLabel: 'UPC label',
    description:
      'Photograph the barcode on the back or bottom of the box — the black-and-white lines with numbers underneath (e.g. 6 3025 123456). Most reliable for product lookup.',
    recommended: true,
  },
  {
    value: 'label',
    label: 'Product label (front)',
    shortLabel: 'Front label',
    description:
      'Photograph the front of the packaging. We read the stylized title and other label text with AI — great when a UPC is hard to reach.',
  },
];

export const PRICING_MODE_OPTIONS: { value: PricingMode; label: string }[] = [
  { value: 'market', label: 'Market price' },
  { value: 'percent_below', label: '% below market' },
  { value: 'manual', label: 'Manual price' },
];

export function normalizePhotoCaptureTarget(value: unknown): PhotoCaptureTarget | null {
  if (value === 'upc' || value === 'label') return value;
  return null;
}

export function normalizePricingMode(value: unknown): PricingMode {
  if (value === 'market' || value === 'percent_below' || value === 'manual') return value;
  return 'market';
}

export function normalizeMarketPricePreference(value: unknown): MarketPricePreference {
  if (value === 'ebay' || value === 'upc' || value === 'show_all') return value;
  return 'ebay';
}

export function normalizePercentBelow(value: unknown): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return DEFAULT_USER_SETTINGS.defaultPercentBelow;
  return Math.min(99, Math.max(1, n));
}

function migrateConfiguredDefaults(raw: Partial<UserSettings> | null | undefined): Partial<Record<UserSettingKey, true>> {
  if (raw?.configuredDefaults && typeof raw.configuredDefaults === 'object') {
    return { ...raw.configuredDefaults };
  }

  if (!raw) return {};

  const configured: Partial<Record<UserSettingKey, true>> = {};
  if (raw.defaultTitleCase !== undefined) configured.titleCase = true;
  if (raw.defaultDescriptionCase !== undefined) configured.descriptionCase = true;
  if (raw.defaultPricingMode !== undefined) configured.pricingMode = true;
  if (raw.defaultPercentBelow !== undefined) configured.percentBelow = true;
  if (raw.defaultPhotoCaptureTarget != null) configured.photoCaptureTarget = true;
  if (raw.defaultMarketPricePreference !== undefined) configured.marketPriceSource = true;
  return configured;
}

export function loadUserSettings(raw: Partial<UserSettings> | null | undefined): UserSettings {
  return {
    defaultPhotoCaptureTarget: normalizePhotoCaptureTarget(raw?.defaultPhotoCaptureTarget),
    defaultTitleCase: normalizeTextCaseFormat(raw?.defaultTitleCase),
    defaultDescriptionCase: normalizeTextCaseFormat(raw?.defaultDescriptionCase),
    defaultPricingMode: normalizePricingMode(raw?.defaultPricingMode),
    defaultPercentBelow: normalizePercentBelow(raw?.defaultPercentBelow),
    defaultMarketPricePreference: normalizeMarketPricePreference(raw?.defaultMarketPricePreference),
    configuredDefaults: migrateConfiguredDefaults(raw),
  };
}

export function isDefaultConfigured(settings: UserSettings, key: UserSettingKey): boolean {
  return settings.configuredDefaults[key] === true;
}

export function settingLabel(key: UserSettingKey): string {
  switch (key) {
    case 'photoCaptureTarget':
      return 'Photo type';
    case 'titleCase':
      return 'Title capitalization';
    case 'descriptionCase':
      return 'Description capitalization';
    case 'pricingMode':
      return 'Pricing mode';
    case 'percentBelow':
      return 'Discount below market';
    case 'marketPriceSource':
      return 'Market price source';
  }
}

export function describePhotoCaptureTarget(target: PhotoCaptureTarget): string {
  return PHOTO_CAPTURE_TARGET_OPTIONS.find(o => o.value === target)?.label ?? target;
}

export function describeTextCaseFormat(format: TextCaseFormat): string {
  if (format === 'as_detected') return 'As detected';
  if (format === 'lowercase') return 'lowercase';
  if (format === 'sentence') return 'Sentence case';
  if (format === 'title') return 'Title Case';
  if (format === 'upper') return 'ALL CAPS';
  return format;
}

export function describePricingMode(mode: PricingMode, percentBelow?: number): string {
  if (mode === 'manual') return 'Manual price';
  if (mode === 'percent_below') return `${percentBelow ?? DEFAULT_USER_SETTINGS.defaultPercentBelow}% below market`;
  return 'Market price';
}

export function describeMarketPricePreference(preference: MarketPricePreference): string {
  return MARKET_PRICE_PREFERENCE_OPTIONS.find(o => o.value === preference)?.label ?? preference;
}

export interface DraftPricingInput {
  manualPrice: number;
  pricingMode?: PricingMode;
  percentBelow?: number;
}

/** Resolve pricing fields for a new listing, honoring user defaults and CSV price imports. */
export function resolveDefaultPricing(
  settings: UserSettings,
  draft: DraftPricingInput,
): { pricingMode: PricingMode; percentBelow: number; manualPrice: number } {
  const hasImportManualPrice = draft.manualPrice > 0;

  if (hasImportManualPrice) {
    return {
      pricingMode: 'manual',
      percentBelow: settings.defaultPercentBelow,
      manualPrice: draft.manualPrice,
    };
  }

  return {
    pricingMode: settings.defaultPricingMode,
    percentBelow: settings.defaultPercentBelow,
    manualPrice: 0,
  };
}
