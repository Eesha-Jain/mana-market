'use client';

import type { ItemListing } from '@/types';
import type { ItemTableContext, ItemTableVariantConfig } from './types';
import { RemoveItemCell, stopRowClick } from './cells';

interface ItemTableRowProps {
  item: ItemListing;
  config: ItemTableVariantConfig;
  ctx: ItemTableContext;
}

export function ItemTableRow({ item, config, ctx }: ItemTableRowProps) {
  const { columns, customRows } = config;
  const totalColumnCount = columns.length + (ctx.showRemove ? 1 : 0);

  for (const customRow of customRows ?? []) {
    if (customRow.match(item)) {
      return customRow.render({ item, ctx, columns, totalColumnCount });
    }
  }

  const clickable = config.isRowClickable?.(item, ctx) ?? false;
  const extraClass = config.rowClassName?.(item, ctx);
  const className = [clickable && 'row--clickable', extraClass].filter(Boolean).join(' ') || undefined;

  return (
    <tr
      className={className}
      onClick={clickable ? () => config.onRowClick?.(item, ctx) : undefined}
    >
      {columns.map(column => (
        <td
          key={column.id}
          className={column.className}
          onClick={column.stopPropagation ? stopRowClick : undefined}
        >
          {column.render(item, ctx)}
        </td>
      ))}
      {ctx.showRemove && (
        <td onClick={stopRowClick}>
          <RemoveItemCell itemId={item.id} onRemove={ctx.onRemove!} />
        </td>
      )}
    </tr>
  );
}
