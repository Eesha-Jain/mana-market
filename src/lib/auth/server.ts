import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env/public';
import { createServerSupabase } from '@/lib/supabase/server';

export function isSupabaseAuthRequired(): boolean {
  return !!(publicEnv('SUPABASE_URL') && publicEnv('SUPABASE_ANON_KEY'));
}

export function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

export async function verifyAccessToken(
  accessToken: string | null | undefined,
): Promise<string | null> {
  if (!accessToken?.trim()) return null;

  const supabase = createServerSupabase(accessToken);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

export async function requireAccessToken(
  accessToken: string | null | undefined,
): Promise<string> {
  const userId = await verifyAccessToken(accessToken);
  if (!userId) throw new Error('Unauthorized');
  return userId;
}

export async function withAuthenticatedClient<T>(
  accessToken: string,
  fn: (supabase: SupabaseClient, userId: string) => Promise<T>,
): Promise<T> {
  const userId = await requireAccessToken(accessToken);
  const supabase = createServerSupabase(accessToken);
  return fn(supabase, userId);
}

/** Returns user id when auth succeeds, or a 401 Response when Supabase auth is required. */
export async function requireApiAuth(request: Request): Promise<string | Response> {
  if (!isSupabaseAuthRequired()) return '';

  const userId = await verifyAccessToken(readBearerToken(request));
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return userId;
}
