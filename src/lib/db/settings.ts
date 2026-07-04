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

export async function fetchUserSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[supabase] fetchUserSettings', error);
    throw error;
  }

  if (!data?.settings) return null;
  return loadUserSettings(data.settings as Partial<UserSettings>);
}

export async function saveUserSettings(
  supabase: SupabaseClient,
  userId: string,
  settings: UserSettings,
): Promise<void> {
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    settings,
    updated_at: new Date().toISOString(),
  });

  assertNoError(error, 'save settings');
}
