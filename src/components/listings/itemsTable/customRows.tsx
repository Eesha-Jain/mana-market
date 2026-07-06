import {
  isItemPending,
  isItemUnresolvedAmbiguous,
  isItemUnresolvedNotFound,
} from '@/utils/itemStatus';
import type { CustomRowDef } from './types';
import { ItemListingIdCell, ItemThumbCell, RemoveItemCell } from './cells';

/** Span from the product column through the last data column */
function middleColSpan(columnCount: number) {
  return columnCount - 2;
}

export const REVIEW_CUSTOM_ROWS: CustomRowDef[] = [
  {
    match: isItemPending,
    render: ({ item, totalColumnCount }) => (
      <tr className="row--searching">
        <td colSpan={totalColumnCount}>
          <div className="searching-row">
            <div className="spinner spinner--sm" />
            <span>Looking up <strong>{item.query}</strong>…</span>
          </div>
        </td>
      </tr>
    ),
  },
  {
    match: isItemUnresolvedNotFound,
    render: ({ item, ctx, columns }) => (
      <tr
        className="row--error row--clickable"
        onClick={() => ctx.onRowClick?.(item)}
      >
        <td>
          <ItemThumbCell item={item} fallback="❓" />
        </td>
        <td className="item-listing-id-cell">
          <ItemListingIdCell item={item} />
        </td>
        <td colSpan={middleColSpan(columns.length)}>
          <div className="not-found-row">
            <span className="badge badge--red">Not Found</span>
            <span className="text-muted">&quot;{item.query}&quot;</span>
            <button
              className="btn-secondary btn-sm"
              onClick={e => { e.stopPropagation(); ctx.onRowClick?.(item); }}
            >
              Edit / Retry →
            </button>
          </div>
        </td>
        {ctx.showRemove && (
          <td>
            <RemoveItemCell itemId={item.id} onRemove={ctx.onRemove!} />
          </td>
        )}
      </tr>
    ),
  },
  {
    match: isItemUnresolvedAmbiguous,
    render: ({ item, ctx, columns }) => (
      <tr
        className="row--warning row--clickable"
        onClick={() => ctx.onRowClick?.(item)}
      >
        <td>
          <ItemThumbCell item={item} fallback="⚠️" />
        </td>
        <td className="item-listing-id-cell">
          <ItemListingIdCell item={item} />
        </td>
        <td colSpan={middleColSpan(columns.length)}>
          <div className="ambiguous-row">
            <span className="badge badge--yellow">Ambiguous</span>
            <span>&quot;{item.query}&quot; matched {item.ambiguousResults?.length} products</span>
            <button
              className="btn-secondary btn-sm"
              onClick={e => {
                e.stopPropagation();
                ctx.onResolveAmbiguous?.(item);
              }}
            >
              Select Product →
            </button>
          </div>
        </td>
        {ctx.showRemove && (
          <td>
            <RemoveItemCell itemId={item.id} onRemove={ctx.onRemove!} />
          </td>
        )}
      </tr>
    ),
  },
];
