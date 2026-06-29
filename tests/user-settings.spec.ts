import { test, expect } from '@playwright/test';
import {
  resolveDefaultPricing,
  loadUserSettings,
  DEFAULT_USER_SETTINGS,
} from '../src/utils/userSettings';

test.describe('userSettings', () => {
  test('resolveDefaultPricing uses user defaults', () => {
    expect(
      resolveDefaultPricing(
        { ...DEFAULT_USER_SETTINGS, defaultPricingMode: 'percent_below', defaultPercentBelow: 15 },
        { manualPrice: 0 },
      ),
    ).toEqual({
      pricingMode: 'percent_below',
      percentBelow: 15,
      manualPrice: 0,
    });
  });

  test('resolveDefaultPricing keeps CSV manual price import', () => {
    expect(
      resolveDefaultPricing(DEFAULT_USER_SETTINGS, { manualPrice: 49.99 }),
    ).toEqual({
      pricingMode: 'manual',
      percentBelow: 10,
      manualPrice: 49.99,
    });
  });

  test('loadUserSettings migrates partial stored settings', () => {
    expect(
      loadUserSettings({
        defaultTitleCase: 'title',
        defaultPricingMode: 'percent_below',
        defaultPercentBelow: 20,
      }),
    ).toMatchObject({
      defaultTitleCase: 'title',
      defaultPricingMode: 'percent_below',
      defaultPercentBelow: 20,
      defaultDescriptionCase: 'as_detected',
      defaultPhotoCaptureTarget: null,
      configuredDefaults: {
        titleCase: true,
        pricingMode: true,
        percentBelow: true,
      },
    });
  });

  test('photo capture target stays unset until configured', () => {
    expect(loadUserSettings({})).toMatchObject({
      defaultPhotoCaptureTarget: null,
      configuredDefaults: {},
    });
    expect(
      loadUserSettings({
        defaultPhotoCaptureTarget: 'upc',
        configuredDefaults: { photoCaptureTarget: true },
      }),
    ).toMatchObject({
      defaultPhotoCaptureTarget: 'upc',
      configuredDefaults: { photoCaptureTarget: true },
    });
  });
});
