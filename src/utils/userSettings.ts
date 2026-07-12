import type { PricingMode, MarketPricePreference, DefaultPricingDraft } from '../types';
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

/** Stored user settings. Null means the user has not saved a preference yet. */
export interface UserSettings {
  photoCaptureTarget: PhotoCaptureTarget | null;
  titleCase: TextCaseFormat | null;
  descriptionCase: TextCaseFormat | null;
  pricingMode: PricingMode | null;
  percentBelow: number | null;
  marketPricePreference: MarketPricePreference | null;
}

/** Empty stored settings — all preferences unset. */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  photoCaptureTarget: null,
  titleCase: null,
  descriptionCase: null,
  pricingMode: null,
  percentBelow: null,
  marketPricePreference: null,
};

/** App fallbacks used when a stored setting is null. */
export const USER_SETTINGS_FALLBACKS = {
  titleCase: 'as_detected' as TextCaseFormat,
  descriptionCase: 'as_detected' as TextCaseFormat,
  pricingMode: 'market' as PricingMode,
  percentBelow: 10,
  marketPricePreference: 'ebay' as MarketPricePreference,
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

export function normalizePricingMode(value: unknown): PricingMode | null {
  if (value === 'market' || value === 'percent_below' || value === 'manual') return value;
  return null;
}

export function normalizeMarketPricePreference(value: unknown): MarketPricePreference | null {
  if (value === 'ebay' || value === 'upc' || value === 'show_all') return value;
  return null;
}

export function normalizePercentBelow(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(99, Math.max(1, n));
}

function normalizeTextCaseFormatStored(value: unknown): TextCaseFormat | null {
  if (value == null || value === '') return null;
  return normalizeTextCaseFormat(value);
}

type LegacyUserSettings = Partial<UserSettings> & {
  configuredDefaults?: Partial<Record<UserSettingKey, true>>;
  defaultPhotoCaptureTarget?: PhotoCaptureTarget | null;
  defaultTitleCase?: TextCaseFormat | null;
  defaultDescriptionCase?: TextCaseFormat | null;
  defaultPricingMode?: PricingMode | null;
  defaultPercentBelow?: number | null;
  defaultMarketPricePreference?: MarketPricePreference | null;
};

function readStoredField<T>(
  raw: LegacyUserSettings,
  key: keyof UserSettings,
  legacyKey: keyof LegacyUserSettings,
): T | null | undefined {
  if (raw[key] !== undefined) return raw[key] as T | null;
  return raw[legacyKey] as T | null | undefined;
}

function migrateFromConfiguredDefaults(raw: LegacyUserSettings): UserSettings {
  const configured = raw.configuredDefaults ?? {};
  return {
    photoCaptureTarget: configured.photoCaptureTarget
      ? normalizePhotoCaptureTarget(readStoredField(raw, 'photoCaptureTarget', 'defaultPhotoCaptureTarget'))
      : null,
    titleCase: configured.titleCase
      ? normalizeTextCaseFormatStored(readStoredField(raw, 'titleCase', 'defaultTitleCase'))
      : null,
    descriptionCase: configured.descriptionCase
      ? normalizeTextCaseFormatStored(readStoredField(raw, 'descriptionCase', 'defaultDescriptionCase'))
      : null,
    pricingMode: configured.pricingMode
      ? normalizePricingMode(readStoredField(raw, 'pricingMode', 'defaultPricingMode'))
      : null,
    percentBelow: configured.percentBelow
      ? normalizePercentBelow(readStoredField(raw, 'percentBelow', 'defaultPercentBelow'))
      : null,
    marketPricePreference: configured.marketPriceSource
      ? normalizeMarketPricePreference(
          readStoredField(raw, 'marketPricePreference', 'defaultMarketPricePreference'),
        )
      : null,
  };
}

export function loadUserSettings(raw: LegacyUserSettings | null | undefined): UserSettings {
  if (!raw) return DEFAULT_USER_SETTINGS;
  if (raw.configuredDefaults) return migrateFromConfiguredDefaults(raw);

  return {
    photoCaptureTarget: normalizePhotoCaptureTarget(
      readStoredField(raw, 'photoCaptureTarget', 'defaultPhotoCaptureTarget'),
    ),
    titleCase: normalizeTextCaseFormatStored(readStoredField(raw, 'titleCase', 'defaultTitleCase')),
    descriptionCase: normalizeTextCaseFormatStored(
      readStoredField(raw, 'descriptionCase', 'defaultDescriptionCase'),
    ),
    pricingMode: normalizePricingMode(readStoredField(raw, 'pricingMode', 'defaultPricingMode')),
    percentBelow: normalizePercentBelow(readStoredField(raw, 'percentBelow', 'defaultPercentBelow')),
    marketPricePreference: normalizeMarketPricePreference(
      readStoredField(raw, 'marketPricePreference', 'defaultMarketPricePreference'),
    ),
  };
}

export function resolveTitleCase(settings: UserSettings): TextCaseFormat {
  return settings.titleCase ?? USER_SETTINGS_FALLBACKS.titleCase;
}

export function resolveDescriptionCase(settings: UserSettings): TextCaseFormat {
  return settings.descriptionCase ?? USER_SETTINGS_FALLBACKS.descriptionCase;
}

export function resolvePricingMode(settings: UserSettings): PricingMode {
  return settings.pricingMode ?? USER_SETTINGS_FALLBACKS.pricingMode;
}

export function resolvePercentBelow(settings: UserSettings): number {
  return settings.percentBelow ?? USER_SETTINGS_FALLBACKS.percentBelow;
}

export function resolveMarketPricePreference(settings: UserSettings): MarketPricePreference {
  return settings.marketPricePreference ?? USER_SETTINGS_FALLBACKS.marketPricePreference;
}

export function isSettingConfigured(settings: UserSettings, key: UserSettingKey): boolean {
  switch (key) {
    case 'photoCaptureTarget':
      return settings.photoCaptureTarget != null;
    case 'titleCase':
      return settings.titleCase != null;
    case 'descriptionCase':
      return settings.descriptionCase != null;
    case 'pricingMode':
      return settings.pricingMode != null;
    case 'percentBelow':
      return settings.percentBelow != null;
    case 'marketPriceSource':
      return settings.marketPricePreference != null;
  }
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
  if (mode === 'percent_below') {
    return `${percentBelow ?? USER_SETTINGS_FALLBACKS.percentBelow}% below market`;
  }
  return 'Market price';
}

export function describeMarketPricePreference(preference: MarketPricePreference): string {
  return MARKET_PRICE_PREFERENCE_OPTIONS.find(o => o.value === preference)?.label ?? preference;
}

export type { DefaultPricingDraft } from '../types';

/** Resolve pricing fields for a new listing, honoring user defaults and CSV price imports. */
export function resolveDefaultPricing(
  settings: UserSettings,
  draft: DefaultPricingDraft,
): { pricingMode: PricingMode; percentBelow: number; manualPrice: number } {
  const hasImportManualPrice = draft.manualPrice > 0;

  if (hasImportManualPrice) {
    return {
      pricingMode: 'manual',
      percentBelow: resolvePercentBelow(settings),
      manualPrice: draft.manualPrice,
    };
  }

  return {
    pricingMode: resolvePricingMode(settings),
    percentBelow: resolvePercentBelow(settings),
    manualPrice: 0,
  };
}
