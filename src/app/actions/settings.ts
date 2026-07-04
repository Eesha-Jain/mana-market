'use server';

import type { UserSettings } from '@/utils/userSettings';
import { requireAccessToken } from '@/lib/auth/server';
import { createServerSupabase } from '@/lib/supabase/server';
import * as settingsDb from '@/lib/db/settings';

export async function fetchUserSettingsAction(
  accessToken: string,
): Promise<UserSettings | null> {
  const userId = await requireAccessToken(accessToken);
  const supabase = createServerSupabase(accessToken);
  return settingsDb.fetchUserSettings(supabase, userId);
}

export async function saveUserSettingsAction(
  accessToken: string,
  settings: UserSettings,
): Promise<void> {
  const userId = await requireAccessToken(accessToken);
  const supabase = createServerSupabase(accessToken);
  await settingsDb.saveUserSettings(supabase, userId, settings);
}
