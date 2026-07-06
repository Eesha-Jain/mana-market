'use client';

import type { ItemListing } from '@/types';
import { TABLE_CONFIGS } from './itemsTable/columns';
import { ItemTableRow } from './itemsTable/ItemTableRow';
import type { ItemsTableVariant } from './itemsTable/types';

export interface ItemsTableProps {
  items: ItemListing[];
  variant?: ItemsTableVariant;
  onRowClick?: (item: ItemListing) => void;
  onRemove?: (itemId: string) => void;
  onUpdate?: (itemId: string, updates: Partial<ItemListing>) => void;
  onResolveAmbiguous?: (item: ItemListing) => void;
}

export function ItemsTable({
  items,
  variant = 'standard',
  onRowClick,
  onRemove,
  onUpdate,
  onResolveAmbiguous,
}: ItemsTableProps) {
  const config = TABLE_CONFIGS[variant];
  const ctx = {
    onRowClick,
    onRemove,
    onUpdate,
    onResolveAmbiguous,
    showRemove: !!onRemove,
  };

  return (
    <div className="items-table-wrapper">
      <table className="items-table">
        <thead>
          <tr>
            {config.columns.map(column => (
              <th
                key={column.id}
                style={
                  column.headerWidth !== undefined
                    ? { width: column.headerWidth, ...column.headerStyle }
                    : column.headerStyle
                }
              >
                {column.header}
              </th>
            ))}
            {ctx.showRemove && <th />}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <ItemTableRow key={item.id} item={item} config={config} ctx={ctx} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
