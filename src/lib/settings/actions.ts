'use server';

import type { UserSettings } from '@/utils/userSettings';
import { withAuthenticatedClient } from '@/lib/auth/server';
import * as settingsDb from '@/lib/db/settings';

export async function fetchUserSettingsAction(
  accessToken: string,
): Promise<UserSettings | null> {
  return withAuthenticatedClient(accessToken, (supabase, userId) =>
    settingsDb.fetchUserSettings(supabase, userId),
  );
}

export async function saveUserSettingsAction(
  accessToken: string,
  settings: UserSettings,
): Promise<void> {
  await withAuthenticatedClient(accessToken, (supabase, userId) =>
    settingsDb.saveUserSettings(supabase, userId, settings),
  );
}
