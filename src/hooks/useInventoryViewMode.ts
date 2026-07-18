'use client';

import { useEffect, useState } from 'react';
import type { InventoryViewMode } from '@/components/inventory/InventoryViewToggle';

const STORAGE_KEY = 'mana-market:inventory-view-mode';

function readStoredMode(): InventoryViewMode {
  if (typeof window === 'undefined') return 'cards';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'table' || stored === 'cards') return stored;
  } catch {
    /* ignore */
  }
  return 'cards';
}

export function useInventoryViewMode() {
  const [viewMode, setViewModeState] = useState<InventoryViewMode>('cards');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setViewModeState(readStoredMode());
    setHydrated(true);
  }, []);

  const setViewMode = (mode: InventoryViewMode) => {
    setViewModeState(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  return { viewMode, setViewMode, hydrated };
}
