'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import type { Session } from '@supabase/supabase-js';
import { subscribeToAuthUser, resolveAuthUser, userFromSupabase, type AuthUser } from '@/lib/auth/client';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';

export type User = AuthUser;

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  /** Sync React auth state after sign-in / sign-up (avoids race with ProtectedRoute). */
  refreshSession: (session?: Session | null) => Promise<User | null>;
  /** Apply auth user immediately (e.g. right after sign-in response). */
  setAuthUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setAuthUser = useCallback((next: User) => {
    flushSync(() => setUser(next));
  }, []);

  const refreshSession = useCallback(async (knownSession?: Session | null): Promise<User | null> => {
    if (!isSupabaseConfigured()) {
      flushSync(() => setUser(null));
      return null;
    }

    const supabase = getSupabase();

    if (knownSession) {
      const { error: setError } = await supabase.auth.setSession(knownSession);
      if (setError) {
        throw new Error(setError.message);
      }
    }

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error(error.message);
    }

    if (!session?.user) {
      flushSync(() => setUser(null));
      return null;
    }

    const fast = userFromSupabase(session.user);
    flushSync(() => setUser(fast));
    void resolveAuthUser(session.user.id, session.user.email)
      .then(enriched => flushSync(() => setUser(enriched)))
      .catch(() => {});
    return fast;
  }, []);

  useEffect(() => {
    return subscribeToAuthUser(
      next => flushSync(() => setUser(next)),
      () => setIsLoading(false),
    );
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, refreshSession, setAuthUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
