'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ItemsProvider } from '@/contexts/ItemsContext';
import { UserSettingsProvider } from '@/contexts/UserSettingsContext';

/** Root providers shared by public and authenticated routes. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <UserSettingsProvider>
        <ItemsProvider>{children}</ItemsProvider>
      </UserSettingsProvider>
    </AuthProvider>
  );
}
