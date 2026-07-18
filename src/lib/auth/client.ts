'use client';

import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { getSupabase, getAccessToken } from '@/lib/supabase/client';
import type { AppUser } from '@/lib/db/profiles';
import { fetchProfileAction } from '@/lib/profiles/actions';

export type AuthUser = AppUser;

export type AuthResult = {
  success: boolean;
  error?: string;
  user?: AuthUser;
  session?: Session | null;
  needsEmailConfirmation?: boolean;
};

function fallbackUser(userId: string, email: string | undefined): AuthUser {
  return {
    id: userId,
    email: email?.toLowerCase() ?? '',
    name: email?.split('@')[0] ?? 'User',
  };
}

export function userFromSupabase(authUser: SupabaseUser): AuthUser {
  const email = authUser.email?.toLowerCase() ?? '';
  const name = String(
    authUser.user_metadata?.name ??
    email.split('@')[0] ??
    'User',
  );

  return {
    id: authUser.id,
    email,
    name,
  };
}

export async function resolveAuthUser(userId: string, email: string | undefined): Promise<AuthUser> {
  try {
    const token = await getAccessToken();
    if (token) {
      const profile = await fetchProfileAction(token);
      if (profile) return profile;
    }
  } catch (err) {
    console.error('[auth] fetchProfile', err);
  }

  try {
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
  } catch {
    return fallbackUser(userId, email);
  }
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) return { success: false, error: error.message };

    if (!data.session) {
      return {
        success: false,
        error: 'Sign in did not complete. Check your email confirmation or try again.',
      };
    }

    if (data.user) {
      return {
        success: true,
        user: userFromSupabase(data.user),
        session: data.session,
      };
    }

    return { success: false, error: 'Sign in failed — no user returned.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign in failed.';
    return { success: false, error: message };
  }
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { name: name.trim() },
      },
    });

    if (error) return { success: false, error: error.message };

    if (data.user?.identities?.length === 0) {
      return {
        success: false,
        error: 'An account with this email already exists. Sign in instead.',
      };
    }

    if (!data.session) {
      return {
        success: false,
        needsEmailConfirmation: true,
        error:
          'Account created. Check your email for a confirmation link, then sign in here.',
      };
    }

    if (data.user) {
      return {
        success: true,
        user: userFromSupabase(data.user),
        session: data.session,
      };
    }

    return { success: false, error: 'Registration failed — no user returned.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed.';
    return { success: false, error: message };
  }
}

export function logout(): void {
  void getSupabase().auth.signOut();
}

/** Subscribe to auth session changes. Calls onReady once the initial session is resolved. */
export function subscribeToAuthUser(
  onUser: (user: AuthUser | null) => void,
  onReady?: () => void,
): () => void {
  const supabase = getSupabase();
  let active = true;

  const finishReady = () => {
    if (active) onReady?.();
  };

  const applySessionUser = (authUser: SupabaseUser) => {
    if (!active) return;
    const fast = userFromSupabase(authUser);
    onUser(fast);
    // Profile fetch must not block onAuthStateChange — signUp/signIn wait for this callback.
    void resolveAuthUser(authUser.id, authUser.email)
      .then(enriched => {
        if (active) onUser(enriched);
      })
      .catch(err => {
        console.error('[auth] resolveAuthUser', err);
      });
  };

  supabase.auth.getSession()
    .then(({ data: { session } }) => {
      if (!active) return;
      finishReady();
      if (session?.user) {
        applySessionUser(session.user);
      }
    })
    .catch(err => {
      console.error('[auth] getSession', err);
      finishReady();
    });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!active) return;
    finishReady();
    if (session?.user) {
      applySessionUser(session.user);
    } else {
      onUser(null);
    }
  });

  return () => {
    active = false;
    subscription.unsubscribe();
  };
}
