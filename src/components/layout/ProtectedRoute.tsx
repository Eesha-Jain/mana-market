'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading, refreshSession } = useAuth();
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (user) {
      setSessionChecked(true);
      return;
    }

    if (sessionChecked) {
      router.replace('/login');
      return;
    }

    let active = true;
    void refreshSession()
      .then(resolved => {
        if (!active) return;
        setSessionChecked(true);
        if (!resolved) router.replace('/login');
      })
      .catch(() => {
        if (!active) return;
        setSessionChecked(true);
        router.replace('/login');
      });

    return () => {
      active = false;
    };
  }, [user, isLoading, sessionChecked, router, refreshSession]);

  if (isLoading || (!user && !sessionChecked)) {
    return (
      <div className="loading-full">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
