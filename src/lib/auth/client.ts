'use client';

import { getSupabase, getAccessToken, isSupabaseConfigured } from '@/lib/supabase/client';
import type { AppUser } from '@/lib/db/profiles';
import { fetchProfileAction } from '@/lib/profiles/actions';
import {
  isLocalAuthMode,
  loadLocalSession,
  localLogin,
  localLogout,
  localRegister,
} from '@/lib/localAuth';

export type AuthUser = AppUser;

export type AuthResult = {
  success: boolean;
  error?: string;
  user?: AuthUser;
};

const SESSION_CHANGE_EVENT = 'mtg-auth-session-change';

function notifySessionChange() {
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

function fallbackUser(userId: string, email: string | undefined): AuthUser {
  return {
    id: userId,
    email: email?.toLowerCase() ?? '',
    name: email?.split('@')[0] ?? 'User',
  };
}

export async function resolveAuthUser(userId: string, email: string | undefined): Promise<AuthUser> {
  const token = await getAccessToken();
  const profile = token ? await fetchProfileAction(token) : null;
  if (profile) return profile;

  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const name =
    user?.user_metadata?.name ??
    email?.split('@')[0] ??
    'User';

  return {
    id: userId,
    email: email?.toLowerCase() ?? '',
    name: String(name),
  };
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResult> {
  if (isLocalAuthMode()) {
    const result = await localLogin(email, password);
    if (result.success) notifySessionChange();
    return { success: result.success, error: result.error, user: result.user };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) return { success: false, error: error.message };

  if (data.user) {
    const user = await resolveAuthUser(data.user.id, data.user.email);
    return { success: true, user };
  }

  return { success: true };
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  if (isLocalAuthMode()) {
    const result = await localRegister(name, email, password);
    if (result.success) notifySessionChange();
    return { success: result.success, error: result.error, user: result.user };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { name: name.trim() },
    },
  });

  if (error) return { success: false, error: error.message };

  if (!data.session) {
    return {
      success: false,
      error: 'Check your email to confirm your account, then sign in.',
    };
  }

  if (data.user) {
    const user = await resolveAuthUser(data.user.id, data.user.email);
    return { success: true, user };
  }

  return { success: true };
}

export function logout(): void {
  if (isLocalAuthMode()) {
    localLogout();
    notifySessionChange();
    return;
  }

  void getSupabase().auth.signOut();
}

/** Subscribe to auth session changes. Calls onReady once the initial session is resolved. */
export function subscribeToAuthUser(
  onUser: (user: AuthUser | null) => void,
  onReady?: () => void,
): () => void {
  if (!isSupabaseConfigured()) {
    onUser(loadLocalSession());
    onReady?.();

    const handler = () => onUser(loadLocalSession());
    window.addEventListener(SESSION_CHANGE_EVENT, handler);
    return () => window.removeEventListener(SESSION_CHANGE_EVENT, handler);
  }

  const supabase = getSupabase();
  let active = true;

  const finishReady = () => {
    if (active) onReady?.();
  };

  const applySession = async (userId: string, email: string | undefined) => {
    if (!active) return;
    try {
      onUser(await resolveAuthUser(userId, email));
    } catch (err) {
      console.error('[auth] resolveAuthUser', err);
      onUser(fallbackUser(userId, email));
    }
  };

  supabase.auth.getSession()
    .then(async ({ data: { session } }) => {
      if (!active) return;
      finishReady();
      if (session?.user) {
        await applySession(session.user.id, session.user.email);
      }
    })
    .catch(err => {
      console.error('[auth] getSession', err);
      finishReady();
    });

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!active) return;
    finishReady();
    if (session?.user) {
      await applySession(session.user.id, session.user.email);
    } else {
      onUser(null);
    }
  });

  return () => {
    active = false;
    subscription.unsubscribe();
  };
}
