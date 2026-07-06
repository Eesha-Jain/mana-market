'use server';

import type { AppUser } from '@/lib/db/profiles';
import { withAuthenticatedClient } from '@/lib/auth/server';
import * as profilesDb from '@/lib/db/profiles';

export async function fetchProfileAction(accessToken: string): Promise<AppUser | null> {
  return withAuthenticatedClient(accessToken, (supabase, userId) =>
    profilesDb.fetchProfile(supabase, userId),
  );
}
