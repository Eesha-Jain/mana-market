'use client';

import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/auth/client';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { BrandWordmark } from '@/components/ui/BrandWordmark';

const SUPABASE_SETUP_MSG =
  'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.';

export default function Page() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  const { refreshSession, setAuthUser } = useAuth();

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      toast.error(SUPABASE_SETUP_MSG, 12_000);
    }
  }, [toast]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!isSupabaseConfigured()) {
      toast.error(SUPABASE_SETUP_MSG);
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error('Enter your email address.');
      return;
    }
    if (!password) {
      toast.error('Enter your password.');
      return;
    }

    setFormError(null);
    setLoading(true);
    try {
      const result = await login(trimmedEmail, password);

      if (!result.success) {
        const message = result.error ?? 'Login failed. Check your email and password.';
        setFormError(message);
        toast.error(message);
        return;
      }

      if (result.user) setAuthUser(result.user);

      const sessionUser = await refreshSession(result.session);
      if (!sessionUser) {
        const message = 'Signed in with Supabase but session did not load. Try again.';
        setFormError(message);
        toast.error(message);
        return;
      }

      toast.success('Signed in');
      router.push('/manage');
    } catch (err) {
      console.error('[login]', err);
      toast.error(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <BrandLogo variant="auth" decorative />
          <BrandWordmark as="h1" className="auth-wordmark" />
          <p className="auth-subtitle">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {formError && (
            <div className="auth-form-error" role="alert">
              {formError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account?{' '}
          <Link href="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
