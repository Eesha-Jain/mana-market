'use client';

import type { UserItemWithCatalog } from '@/types';
import { InventoryCardGrid } from './InventoryCardGrid';
import { InventoryTable } from './InventoryTable';
import type { InventoryViewMode } from './InventoryViewToggle';

interface InventoryItemsViewProps {
  items: UserItemWithCatalog[];
  viewMode: InventoryViewMode;
  onSelect: (item: UserItemWithCatalog) => void;
  onRemove: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  selectable?: boolean;
  allowRemove?: boolean;
}

export function InventoryItemsView({
  items,
  viewMode,
  onSelect,
  onRemove,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  selectable = false,
  allowRemove = true,
}: InventoryItemsViewProps) {
  if (viewMode === 'cards') {
    return (
      <InventoryCardGrid
        items={items}
        onSelect={onSelect}
        onRemove={onRemove}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        selectable={selectable}
        allowRemove={allowRemove}
      />
    );
  }

  return (
    <InventoryTable
      items={items}
      onSelect={onSelect}
      onRemove={onRemove}
      selectedIds={selectedIds}
      onToggleSelect={onToggleSelect}
      onToggleSelectAll={onToggleSelectAll}
      selectable={selectable}
      allowRemove={allowRemove}
    />
  );
}
