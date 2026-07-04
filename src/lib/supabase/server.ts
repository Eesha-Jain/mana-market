import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env/public';

export function createServerSupabase(accessToken: string): SupabaseClient {
  const url = publicEnv('SUPABASE_URL');
  const key = publicEnv('SUPABASE_ANON_KEY');
  if (!url || !key) {
    throw new Error('Supabase is not configured.');
  }

  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
