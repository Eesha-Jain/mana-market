'use client';

import type { ReactNode } from 'react';
import { Navbar } from '@/components/shell/Navbar';
import { ProtectedRoute } from '@/components/shell/ProtectedRoute';
import { SearchProcessor } from '@/components/upload/SearchProcessor';
import { SyncErrorBanner } from '@/components/shell/SyncErrorBanner';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <SearchProcessor />
      <Navbar />
      <SyncErrorBanner />
      <main className="main-content">{children}</main>
    </ProtectedRoute>
  );
}
