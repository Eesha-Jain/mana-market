'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { BrandWordmark } from '@/components/ui/BrandWordmark';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) router.push('/dashboard');
    else setError(result.error ?? 'Login failed.');
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <BrandLogo variant="auth" decorative />
          <BrandWordmark as="h1" className="auth-wordmark" />
          <p className="auth-subtitle">Sign in to manage your listings</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {error && <div className="form-error-banner">{error}</div>}

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
