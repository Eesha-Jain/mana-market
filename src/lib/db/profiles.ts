import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  email: string;
  name: string;
}

export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[supabase] fetchProfile', error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    name: data.name,
  };
}
