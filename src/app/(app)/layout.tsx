'use client';

import type { ReactNode } from 'react';
import { Navbar } from '@/components/shell/Navbar';
import { ProtectedRoute } from '@/components/shell/ProtectedRoute';
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
