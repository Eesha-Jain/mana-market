import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from './env';

const supabaseUrl = publicEnv('SUPABASE_URL');
const supabaseAnonKey = publicEnv('SUPABASE_ANON_KEY');

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

let client: SupabaseClient | null = null;

/** Shared Supabase client (browser). Throws if env vars are missing. */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set NEXT_APP_SUPABASE_URL and NEXT_APP_SUPABASE_ANON_KEY in .env',
    );
  }

  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }

  return client;
}

export const LISTING_IMAGES_BUCKET = 'listing-images';
