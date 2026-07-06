import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserSettings } from '@/utils/userSettings';
import { loadUserSettings } from '@/utils/userSettings';

function assertNoError(error: { message?: string } | null, operation: string): void {
  if (error) {
    console.error(`[supabase] ${operation}`, error);
    throw new Error(error.message || `Failed to ${operation}`);
  }
}

const USER_SETTINGS_COLUMNS =
  'photo_capture_target, title_case, description_case, pricing_mode, percent_below, market_price_preference' as const;

interface UserSettingsRow {
  photo_capture_target: UserSettings['photoCaptureTarget'];
  title_case: UserSettings['titleCase'];
  description_case: UserSettings['descriptionCase'];
  pricing_mode: UserSettings['pricingMode'];
  percent_below: UserSettings['percentBelow'];
  market_price_preference: UserSettings['marketPricePreference'];
}

function rowToUserSettings(row: UserSettingsRow): UserSettings {
  return loadUserSettings({
    photoCaptureTarget: row.photo_capture_target,
    titleCase: row.title_case,
    descriptionCase: row.description_case,
    pricingMode: row.pricing_mode,
    percentBelow: row.percent_below,
    marketPricePreference: row.market_price_preference,
  });
}

function userSettingsToRow(settings: UserSettings): UserSettingsRow {
  return {
    photo_capture_target: settings.photoCaptureTarget,
    title_case: settings.titleCase,
    description_case: settings.descriptionCase,
    pricing_mode: settings.pricingMode,
    percent_below: settings.percentBelow,
    market_price_preference: settings.marketPricePreference,
  };
}

export async function fetchUserSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select(USER_SETTINGS_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[supabase] fetchUserSettings', error);
    throw error;
  }

  if (!data) return null;
  return rowToUserSettings(data as UserSettingsRow);
}

export async function saveUserSettings(
  supabase: SupabaseClient,
  userId: string,
  settings: UserSettings,
): Promise<void> {
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    ...userSettingsToRow(settings),
  });

  assertNoError(error, 'save settings');
}
