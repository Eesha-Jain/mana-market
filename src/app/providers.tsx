'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ItemsProvider } from '@/contexts/ItemsContext';
import { UserSettingsProvider } from '@/contexts/UserSettingsContext';
import { SearchProcessor } from '@/components/SearchProcessor';
import { SyncErrorBanner } from '@/components/SyncErrorBanner';
import { Navbar } from '@/components/Navbar';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <UserSettingsProvider>
        <ItemsProvider>
          <SearchProcessor />
          <Navbar />
          <SyncErrorBanner />
          <main className="main-content">{children}</main>
        </ItemsProvider>
      </UserSettingsProvider>
    </AuthProvider>
  );
}
