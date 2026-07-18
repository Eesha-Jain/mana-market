'use client';

import type { ReactNode } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { SearchProcessor } from '@/components/upload/SearchProcessor';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <SearchProcessor />
      <Navbar />
      <main className="main-content">{children}</main>
    </ProtectedRoute>
  );
}
