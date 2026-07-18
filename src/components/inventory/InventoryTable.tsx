'use client';

import type { UserItemWithCatalog } from '@/types';
import { MARKETPLACE_LABELS } from '@/types';
import { getItemTitle } from '@/utils/items';
import { getLookupStatusLabel, getWorkflowStatusLabel } from '@/utils/items';

interface InventoryTableProps {
  items: UserItemWithCatalog[];
  onSelect: (item: UserItemWithCatalog) => void;
  onRemove: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  selectable?: boolean;
  allowRemove?: boolean;
}

export function InventoryTable({
  items,
  onSelect,
  onRemove,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  selectable = false,
  allowRemove = true,
}: InventoryTableProps) {
  const allSelected = selectable && items.length > 0 && items.every(i => selectedIds?.has(i.id));

  return (
    <div className="items-table-wrapper">
      <table className="items-table">
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleSelectAll?.()}
                  aria-label="Select all"
                />
              </th>
            )}
            <th>Title</th>
            <th>Price</th>
            <th>Qty</th>
            <th>Status</th>
            <th>Lookup</th>
            <th>Platforms</th>
            {allowRemove && <th />}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr
              key={item.id}
              className="row--clickable"
              onClick={() => onSelect(item)}
            >
              {selectable && (
                <td onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(item.id) ?? false}
                    onChange={() => onToggleSelect?.(item.id)}
                    aria-label={`Select ${getItemTitle(item)}`}
                  />
                </td>
              )}
              <td>
                <span style={{ fontWeight: 500 }}>{getItemTitle(item)}</span>
              </td>
              <td>${item.price.toFixed(2)}</td>
              <td>{item.quantity}</td>
              <td>{getWorkflowStatusLabel(item.workflowStatus)}</td>
              <td className="text-muted">{getLookupStatusLabel(item.lookupStatus)}</td>
              <td className="text-muted">
                {Object.keys(item.marketplaceListings)
                  .map(p => MARKETPLACE_LABELS[p as keyof typeof MARKETPLACE_LABELS] ?? p)
                  .join(', ') || '—'}
              </td>
              {allowRemove && (
                <td>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={e => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                  >
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
