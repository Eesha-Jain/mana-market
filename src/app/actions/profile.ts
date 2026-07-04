'use server';

import type { AppUser } from '@/lib/db/profiles';
import { requireAccessToken } from '@/lib/auth/server';
import { createServerSupabase } from '@/lib/supabase/server';
import * as profilesDb from '@/lib/db/profiles';

export async function fetchProfileAction(accessToken: string): Promise<AppUser | null> {
  const userId = await requireAccessToken(accessToken);
  const supabase = createServerSupabase(accessToken);
  return profilesDb.fetchProfile(supabase, userId);
}
