'use client';

import type { ReactNode } from 'react';
import { Navbar } from '@/components/shell/Navbar';

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="public-shell">{children}</div>
    </>
  );
}
