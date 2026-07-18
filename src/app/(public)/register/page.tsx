'use client';

import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { register } from '@/lib/auth/client';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { BrandWordmark } from '@/components/ui/BrandWordmark';

const SUPABASE_SETUP_MSG =
  'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.';

export default function Page() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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

    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setFormError(null);
    setLoading(true);
    try {
      const result = await register(name.trim(), email.trim(), password);

      if (!result.success) {
        const message = result.error ?? 'Registration failed.';
        setFormError(message);
        toast.error(message, result.needsEmailConfirmation ? 12_000 : undefined);
        return;
      }

      if (result.user) setAuthUser(result.user);

      const sessionUser = await refreshSession(result.session);

      if (!sessionUser) {
        const message = 'Account created but session did not load. Try signing in.';
        setFormError(message);
        toast.error(message);
        return;
      }

      toast.success('Account created');
      router.push('/upload');
    } catch (err) {
      console.error('[register]', err);
      toast.error(err instanceof Error ? err.message : 'Registration failed. Please try again.');
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
          <p className="auth-subtitle">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {formError && (
            <div className="auth-form-error" role="alert">
              {formError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="name">Display Name</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

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
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm">Confirm Password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
