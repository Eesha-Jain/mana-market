import type { TextCaseFormat } from './textCase';
import type { PricingMode } from '../types';
import {
  describePricingMode,
  describeTextCaseFormat,
  isDefaultConfigured,
  settingLabel,
  type UserSettingKey,
  type UserSettings,
} from './userSettings';

export interface DefaultSaveOffer {
  key: UserSettingKey;
  label: string;
  description: string;
}

export interface ReviewDefaultCandidates {
  titleCase?: TextCaseFormat;
  descriptionCase?: TextCaseFormat;
  pricingMode?: PricingMode;
  percentBelow?: number;
}

/** Build "save as default" offers for settings the user changed but has not saved as defaults. */
export function collectReviewDefaultOffers(
  settings: UserSettings,
  candidates: ReviewDefaultCandidates,
  initialPricing: { pricingMode: PricingMode; percentBelow: number },
): DefaultSaveOffer[] {
  const offers: DefaultSaveOffer[] = [];

  if (
    candidates.titleCase &&
    !isDefaultConfigured(settings, 'titleCase') &&
    candidates.titleCase !== settings.defaultTitleCase
  ) {
    offers.push({
      key: 'titleCase',
      label: settingLabel('titleCase'),
      description: describeTextCaseFormat(candidates.titleCase),
    });
  }

  if (
    candidates.descriptionCase &&
    !isDefaultConfigured(settings, 'descriptionCase') &&
    candidates.descriptionCase !== settings.defaultDescriptionCase
  ) {
    offers.push({
      key: 'descriptionCase',
      label: settingLabel('descriptionCase'),
      description: describeTextCaseFormat(candidates.descriptionCase),
    });
  }

  if (
    candidates.pricingMode &&
    !isDefaultConfigured(settings, 'pricingMode') &&
    candidates.pricingMode !== initialPricing.pricingMode
  ) {
    offers.push({
      key: 'pricingMode',
      label: settingLabel('pricingMode'),
      description: describePricingMode(candidates.pricingMode, candidates.percentBelow),
    });
  }

  if (
    candidates.percentBelow != null &&
    candidates.pricingMode === 'percent_below' &&
    !isDefaultConfigured(settings, 'percentBelow') &&
    candidates.percentBelow !== initialPricing.percentBelow
  ) {
    offers.push({
      key: 'percentBelow',
      label: settingLabel('percentBelow'),
      description: `${candidates.percentBelow}% below market`,
    });
  }

  return offers;
}

export function applyReviewDefaultOffers(
  candidates: ReviewDefaultCandidates,
  offers: DefaultSaveOffer[],
): Partial<UserSettings> {
  const patch: Partial<UserSettings> = {};
  const offerKeys = new Set(offers.map(o => o.key));

  if (offerKeys.has('titleCase') && candidates.titleCase) {
    patch.defaultTitleCase = candidates.titleCase;
  }
  if (offerKeys.has('descriptionCase') && candidates.descriptionCase) {
    patch.defaultDescriptionCase = candidates.descriptionCase;
  }
  if (offerKeys.has('pricingMode') && candidates.pricingMode) {
    patch.defaultPricingMode = candidates.pricingMode;
  }
  if (offerKeys.has('percentBelow') && candidates.percentBelow != null) {
    patch.defaultPercentBelow = candidates.percentBelow;
  }

  return patch;
}

export type ReviewDefaultSaveKey = 'titleCase' | 'descriptionCase' | 'pricingMode' | 'percentBelow';

export function keysFromReviewOffers(offers: DefaultSaveOffer[]): ReviewDefaultSaveKey[] {
  return offers
    .map(o => o.key)
    .filter(
      (k): k is ReviewDefaultSaveKey =>
        k === 'titleCase' ||
        k === 'descriptionCase' ||
        k === 'pricingMode' ||
        k === 'percentBelow',
    );
}
