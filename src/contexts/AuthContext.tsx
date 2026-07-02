'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import type { AppUser } from '../lib/supabaseDb';
import { fetchProfile } from '../lib/supabaseDb';
import {
  isLocalAuthMode,
  loadLocalSession,
  localLogin,
  localLogout,
  localRegister,
} from '../lib/localAuth';

export type User = AppUser;

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function resolveSupabaseUser(userId: string, email: string | undefined): Promise<User> {
  const profile = await fetchProfile(userId);
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setUser(loadLocalSession());
      setIsLoading(false);
      return;
    }

    const supabase = getSupabase();
    let active = true;

    const finishLoading = () => {
      if (active) setIsLoading(false);
    };

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!active) return;
        finishLoading();
        if (!session?.user) return;

        try {
          const resolved = await resolveSupabaseUser(session.user.id, session.user.email);
          if (active) setUser(resolved);
        } catch (err) {
          console.error('[auth] resolveSupabaseUser', err);
          if (active) {
            setUser({
              id: session.user.id,
              email: session.user.email?.toLowerCase() ?? '',
              name: session.user.email?.split('@')[0] ?? 'User',
            });
          }
        }
      })
      .catch(err => {
        console.error('[auth] getSession', err);
        finishLoading();
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      finishLoading();
      if (session?.user) {
        try {
          const resolved = await resolveSupabaseUser(session.user.id, session.user.email);
          if (active) setUser(resolved);
        } catch (err) {
          console.error('[auth] resolveSupabaseUser', err);
          if (active) {
            setUser({
              id: session.user.id,
              email: session.user.email?.toLowerCase() ?? '',
              name: session.user.email?.split('@')[0] ?? 'User',
            });
          }
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (isLocalAuthMode()) {
      const result = await localLogin(email, password);
      if (result.success && result.user) setUser(result.user);
      return result;
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) return { success: false, error: error.message };

    if (data.user) {
      const resolved = await resolveSupabaseUser(data.user.id, data.user.email);
      setUser(resolved);
    }

    return { success: true };
  };

  const register = async (
    name: string,
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (isLocalAuthMode()) {
      const result = await localRegister(name, email, password);
      if (result.success && result.user) setUser(result.user);
      return result;
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
      const resolved = await resolveSupabaseUser(data.user.id, data.user.email);
      setUser(resolved);
    }

    return { success: true };
  };

  const logout = () => {
    if (isLocalAuthMode()) {
      localLogout();
      setUser(null);
      return;
    }

    void getSupabase().auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
