'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';

/** Root providers — auth only; app-specific providers live in `(app)/app-shell.tsx`. */
export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
