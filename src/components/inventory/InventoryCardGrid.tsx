'use client';

import type { UserItemWithCatalog } from '@/types';
import { getItemImageUrl, getItemTitle } from '@/utils/items';
import { getLookupStatusLabel } from '@/utils/items';
import { MARKETPLACE_LABELS } from '@/types';

interface InventoryCardGridProps {
  items: UserItemWithCatalog[];
  onSelect: (item: UserItemWithCatalog) => void;
  onRemove: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  selectable?: boolean;
  allowRemove?: boolean;
}

export function InventoryCardGrid({
  items,
  onSelect,
  onRemove,
  selectedIds,
  onToggleSelect,
  selectable = false,
  allowRemove = true,
}: InventoryCardGridProps) {
  return (
    <div className="inventory-grid">
      {items.map(item => {
        const imageUrl = getItemImageUrl(item);
        const platforms = Object.keys(item.marketplaceListings);
        const checked = selectedIds?.has(item.id) ?? false;

        return (
          <article
            key={item.id}
            className={`inventory-card${checked ? ' inventory-card--selected' : ''}`}
            onClick={() => onSelect(item)}
            onKeyDown={e => e.key === 'Enter' && onSelect(item)}
            role="button"
            tabIndex={0}
          >
            {selectable && (
              <label
                className="inventory-card-check"
                onClick={e => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleSelect?.(item.id)}
                  aria-label={`Select ${getItemTitle(item)}`}
                />
              </label>
            )}
            <div className="inventory-card-image">
              {imageUrl ? (
                <img src={imageUrl} alt="" />
              ) : (
                <span className="text-muted">No image</span>
              )}
            </div>
            <div className="inventory-card-body">
              <h3 className="inventory-card-title">{getItemTitle(item)}</h3>
              <div className="inventory-card-meta">
                <span>${item.price.toFixed(2)}</span>
                <span>Qty {item.quantity}</span>
                <span className="badge badge--blue">{getLookupStatusLabel(item.lookupStatus)}</span>
                {platforms.map(p => (
                  <span key={p} className="badge">
                    {MARKETPLACE_LABELS[p as keyof typeof MARKETPLACE_LABELS] ?? p}
                  </span>
                ))}
              </div>
              {allowRemove && (
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={e => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
