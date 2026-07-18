import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env/public';
import { serverEnv } from '@/lib/env/server';

let adminClient: SupabaseClient | null = null;

/** Service-role Supabase client for server-only token storage. Bypasses RLS. */
export function createAdminSupabase(): SupabaseClient {
  const url = publicEnv('SUPABASE_URL');
  const serviceRoleKey = serverEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase admin is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  if (!adminClient) {
    adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return adminClient;
}

export function isAdminSupabaseConfigured(): boolean {
  return !!(publicEnv('SUPABASE_URL') && serverEnv('SUPABASE_SERVICE_ROLE_KEY'));
}
