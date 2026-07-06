'use client';

import type { MouseEvent } from 'react';
import type { ItemListing, EbayCondition, PricingMode } from '@/types';
import {
  EBAY_CONDITIONS,
  getDetectedTitle,
  getItemImageUrl,
  getItemListingDescription,
  getItemTitle,
  patchItemListingDescription,
} from '@/types';
import { formatPrice, getMarketPriceSourceLabel } from '@/utils/productApi';
import { resolveItemMarketSelection } from '@/utils/marketPrice';
import { resolveItemProductType } from '@/utils/productType';
import {
  calculatePrice,
  EBAY_SELLER_ACTIVE_LISTINGS_URL,
  getEbayListingUrl,
  getItemMarketPrice,
} from '@/utils/ebayMapper';
import {
  isItemPending,
  isItemUnresolvedAmbiguous,
  isItemUnresolvedNotFound,
} from '@/utils/itemStatus';
import { ItemStatusBadge } from './ItemStatusBadge';

function formatUpcBrandCell(item: ItemListing): string {
  const product = item.product;
  return [
    product?.upc ? `UPC: ${product.upc}` : item.originalUpc ? `UPC: ${item.originalUpc}` : null,
    item.originalSku ? `SKU: ${item.originalSku}` : null,
    !product?.upc && !item.originalUpc && !item.originalSku ? (product?.brand ?? '—') : null,
  ]
    .filter(Boolean)
    .join(' · ') || '—';
}

function stopRowClick(e: MouseEvent) {
  e.stopPropagation();
}

function EbayListingLink({ item }: { item: ItemListing }) {
  const listingUrl = getEbayListingUrl(item);

  if (listingUrl) {
    return (
      <a
        href={listingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-link btn-sm"
        onClick={stopRowClick}
      >
        View listing ↗
      </a>
    );
  }

  return (
    <a
      href={EBAY_SELLER_ACTIVE_LISTINGS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-link btn-sm text-muted"
      onClick={stopRowClick}
      title="Find your listing in eBay Seller Hub (SKU matches ID column)"
    >
      Seller Hub ↗
    </a>
  );
}

interface RowCallbacks {
  onRowClick?: (item: ItemListing) => void;
  onRemove?: (itemId: string) => void;
  onUpdate?: (itemId: string, updates: Partial<ItemListing>) => void;
  onResolveAmbiguous?: (item: ItemListing) => void;
}

function StandardRow({
  item,
  onRowClick,
  onRemove,
}: RowCallbacks & { item: ItemListing }) {
  const img = getItemImageUrl(item);
  const market = getItemMarketPrice(item);
  const yourPrice = calculatePrice(item);
  const clickable = !!onRowClick;

  return (
    <tr
      className={clickable ? 'row--clickable' : undefined}
      onClick={clickable ? () => onRowClick(item) : undefined}
    >
      <td>
        {img
          ? (
            <img
              src={img}
              alt={getItemTitle(item)}
              className="table-thumb table-thumb--product"
              loading="lazy"
            />
          )
          : <div className="table-thumb table-thumb--empty">📦</div>}
      </td>
      <td className="item-listing-id-cell">
        <span className="item-listing-id">{item.listingId}</span>
      </td>
      <td>
        <span className="item-name">{getItemTitle(item)}</span>
        {item.ebayExportedAt && (
          <span className="badge badge--gray" style={{ marginLeft: 6, fontSize: '0.7rem' }}>
            eBay
          </span>
        )}
      </td>
      <td className="text-muted">{formatUpcBrandCell(item)}</td>
      <td>{item.condition ?? <span className="text-muted">Not set</span>}</td>
      <td>{item.quantity}</td>
      <td>{formatPrice(market)}</td>
      <td className="price-cell">
        {yourPrice !== null ? `$${yourPrice.toFixed(2)}` : '—'}
      </td>
      <td>
        <ItemStatusBadge status={item.status} hasCondition={!!item.condition} />
      </td>
      {onRemove && (
        <td onClick={stopRowClick}>
          <button
            className="btn-icon btn-danger-ghost"
            title="Remove item"
            onClick={() => onRemove(item.id)}
          >
            ✕
          </button>
        </td>
      )}
    </tr>
  );
}

function ExportedRow({
  item,
  onRowClick,
  onRemove,
  onUpdate,
}: RowCallbacks & { item: ItemListing }) {
  const img = getItemImageUrl(item);
  const yourPrice = calculatePrice(item);
  const listingUrl = getEbayListingUrl(item);
  const clickable = !!onRowClick;

  return (
    <tr
      className={[clickable ? 'row--clickable' : undefined, 'row--ebay'].filter(Boolean).join(' ')}
      onClick={clickable ? () => onRowClick(item) : undefined}
    >
      <td>
        {img
          ? (
            <img
              src={img}
              alt={getItemTitle(item)}
              className="table-thumb table-thumb--product"
              loading="lazy"
            />
          )
          : <div className="table-thumb table-thumb--empty">✓</div>}
      </td>
      <td className="item-listing-id-cell">
        <span className="item-listing-id">{item.listingId}</span>
      </td>
      <td>
        <span className="item-name">{getItemTitle(item)}</span>
        {listingUrl && (
          <a
            href={listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="badge badge--blue"
            style={{ marginLeft: 6, fontSize: '0.7rem', textDecoration: 'none' }}
            onClick={stopRowClick}
          >
            Live ↗
          </a>
        )}
      </td>
      <td>{item.condition ?? '—'}</td>
      <td>{item.quantity}</td>
      <td className="price-cell">
        {yourPrice !== null ? `$${yourPrice.toFixed(2)}` : '—'}
      </td>
      <td className="text-muted text-sm">
        {item.ebayExportedAt
          ? new Date(item.ebayExportedAt).toLocaleDateString()
          : '—'}
      </td>
      <td onClick={stopRowClick}>
        {onUpdate ? (
          <select
            className="inline-select"
            value={item.ebayListingStatus ?? 'exported'}
            onChange={e =>
              onUpdate(item.id, {
                ebayListingStatus: e.target.value as ItemListing['ebayListingStatus'],
              })
            }
          >
            <option value="exported">Exported</option>
            <option value="active">Active</option>
            <option value="sold">Sold</option>
            <option value="ended">Ended</option>
          </select>
        ) : (
          item.ebayListingStatus ?? 'exported'
        )}
      </td>
      <td onClick={stopRowClick}>
        <EbayListingLink item={item} />
      </td>
      {onRemove && (
        <td onClick={stopRowClick}>
          <button
            className="btn-icon btn-danger-ghost"
            title="Remove item"
            onClick={() => onRemove(item.id)}
          >
            ✕
          </button>
        </td>
      )}
    </tr>
  );
}

function ReviewRow({
  item,
  onRowClick,
  onRemove,
  onUpdate,
  onResolveAmbiguous,
}: RowCallbacks & { item: ItemListing }) {
  const product = item.product;
  const img = getItemImageUrl(item);
  const market = getItemMarketPrice(item);
  const marketSelection = resolveItemMarketSelection(item);
  const yourPrice = calculatePrice(item);
  const productType = resolveItemProductType(item);

  const update = (updates: Partial<ItemListing>) => onUpdate?.(item.id, updates);

  if (isItemPending(item)) {
    return (
      <tr className="row--searching">
        <td colSpan={10}>
          <div className="searching-row">
            <div className="spinner spinner--sm" />
            <span>Looking up <strong>{item.query}</strong>…</span>
          </div>
        </td>
      </tr>
    );
  }

  if (isItemUnresolvedNotFound(item)) {
    return (
      <tr className="row--error row--clickable" onClick={() => onRowClick?.(item)}>
        <td>
          {img
            ? <img src={img} alt="" className="table-thumb table-thumb--product" />
            : <div className="table-thumb table-thumb--empty">❓</div>}
        </td>
        <td className="item-listing-id-cell">{item.listingId}</td>
        <td colSpan={7}>
          <div className="not-found-row">
            <span className="badge badge--red">Not Found</span>
            <span className="text-muted">"{item.query}"</span>
            <button
              className="btn-secondary btn-sm"
              onClick={e => { e.stopPropagation(); onRowClick?.(item); }}
            >
              Edit / Retry →
            </button>
          </div>
        </td>
        <td></td>
        {onRemove && (
          <td>
            <button
              className="btn-icon btn-danger-ghost"
              onClick={e => { e.stopPropagation(); onRemove(item.id); }}
              title="Remove"
            >
              ✕
            </button>
          </td>
        )}
      </tr>
    );
  }

  if (isItemUnresolvedAmbiguous(item)) {
    return (
      <tr className="row--warning row--clickable" onClick={() => onRowClick?.(item)}>
        <td>
          {img
            ? <img src={img} alt="" className="table-thumb table-thumb--product" />
            : <div className="table-thumb table-thumb--empty">⚠️</div>}
        </td>
        <td className="item-listing-id-cell">{item.listingId}</td>
        <td colSpan={7}>
          <div className="ambiguous-row">
            <span className="badge badge--yellow">Ambiguous</span>
            <span>"{item.query}" matched {item.ambiguousResults?.length} products</span>
            <button
              className="btn-secondary btn-sm"
              onClick={e => {
                e.stopPropagation();
                onResolveAmbiguous?.(item);
              }}
            >
              Select Product →
            </button>
          </div>
        </td>
        <td></td>
        {onRemove && (
          <td>
            <button
              className="btn-icon btn-danger-ghost"
              onClick={e => { e.stopPropagation(); onRemove(item.id); }}
              title="Remove"
            >
              ✕
            </button>
          </td>
        )}
      </tr>
    );
  }

  return (
    <tr className="row--clickable" onClick={() => onRowClick?.(item)}>
      <td>
        <div className="thumb-cell">
          {img
            ? <img src={img} alt={getItemTitle(item)} className="table-thumb table-thumb--product" loading="lazy" />
            : <div className="table-thumb table-thumb--empty">📦</div>}
        </div>
      </td>

      <td className="item-listing-id-cell">
        <span className="item-listing-id">{item.listingId}</span>
      </td>

      <td onClick={stopRowClick}>
        <div className="card-name-cell">
          <input
            type="text"
            className="inline-input inline-input--title"
            placeholder={getDetectedTitle(item)}
            value={item.customTitle ?? getItemTitle(item)}
            onChange={e => update({ customTitle: e.target.value || undefined })}
            title="Edit listing title"
          />
          {item.customTitle && item.customTitle !== getDetectedTitle(item) && (
            <span className="text-muted text-sm" style={{ fontSize: '0.72rem' }}>
              Was: {getDetectedTitle(item)}
            </span>
          )}
          {productType && (
            <span className="card-set-info text-muted">{productType}</span>
          )}
          {product?.upc && (
            <span className="card-set-info text-muted">UPC: {product.upc}</span>
          )}
          {!item.condition && (
            <span className="badge badge--yellow" style={{ fontSize: '0.7rem', marginTop: 2 }}>
              Set condition
            </span>
          )}
        </div>
      </td>

      <td onClick={stopRowClick}>
        <select
          className={`inline-select${!item.condition ? ' inline-select--required' : ''}`}
          value={item.condition ?? ''}
          onChange={e =>
            update({
              condition: e.target.value ? (e.target.value as EbayCondition) : null,
            })
          }
        >
          <option value="">Select…</option>
          {EBAY_CONDITIONS.map(c => (
            <option key={c.id} value={c.label} title={c.mtgEquivalent}>
              {c.label}
            </option>
          ))}
        </select>
      </td>

      <td onClick={stopRowClick}>
        <input
          type="number"
          className="inline-input inline-input--sm"
          min={1}
          max={999}
          value={item.quantity}
          onChange={e => update({ quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
        />
      </td>

      <td className="price-cell">
        <span>{formatPrice(market)}</span>
        {marketSelection.source && (
          <span className="text-muted text-sm" style={{ display: 'block', fontSize: '0.72rem' }}>
            {getMarketPriceSourceLabel(marketSelection.source, 'short')}
          </span>
        )}
        {product?.priceRange && (
          <span className="text-muted text-sm" style={{ display: 'block', fontSize: '0.72rem' }}>
            ${product.priceRange.low}–${product.priceRange.high}
          </span>
        )}
      </td>

      <td onClick={stopRowClick}>
        <div className="pricing-controls">
          <select
            className="inline-select"
            value={item.pricingMode}
            onChange={e => update({ pricingMode: e.target.value as PricingMode })}
          >
            <option value="market">Market</option>
            <option value="percent_below">% below</option>
            <option value="manual">Manual</option>
          </select>
          {item.pricingMode === 'percent_below' && (
            <div className="percent-input-row">
              <input
                type="number"
                className="inline-input inline-input--sm"
                min={1}
                max={99}
                value={item.percentBelow}
                onChange={e =>
                  update({
                    percentBelow: Math.min(99, Math.max(1, parseInt(e.target.value, 10) || 0)),
                  })
                }
              />
              <span className="text-muted">%</span>
            </div>
          )}
          {item.pricingMode === 'manual' && (
            <div className="manual-input-row">
              <span className="text-muted">$</span>
              <input
                type="number"
                className="inline-input inline-input--sm"
                min={0.01}
                step={0.01}
                value={item.manualPrice || ''}
                placeholder="0.00"
                onChange={e => update({ manualPrice: parseFloat(e.target.value) || 0 })}
              />
            </div>
          )}
        </div>
      </td>

      <td className="price-cell price-cell--final">
        {yourPrice !== null ? `$${yourPrice.toFixed(2)}` : <span className="text-muted">—</span>}
      </td>

      <td onClick={stopRowClick}>
        <input
          type="text"
          className="inline-input inline-input--wide"
          placeholder="Description…"
          value={getItemListingDescription(item)}
          onChange={e => update(patchItemListingDescription(e.target.value))}
        />
      </td>

      {onRemove && (
        <td onClick={stopRowClick}>
          <button className="btn-icon btn-danger-ghost" onClick={() => onRemove(item.id)} title="Remove">✕</button>
        </td>
      )}
    </tr>
  );
}

export interface ItemsTableProps {
  items: ItemListing[];
  variant?: 'standard' | 'review' | 'exported';
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
  const rowProps: RowCallbacks = { onRowClick, onRemove, onUpdate, onResolveAmbiguous };

  return (
    <div className="items-table-wrapper">
      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: variant === 'review' ? 56 : 48 }}></th>
            <th style={{ width: 88 }}>ID</th>
            <th>Product</th>
            {variant === 'standard' && <th>UPC / Brand</th>}
            <th>Condition</th>
            <th>Qty</th>
            {(variant === 'standard' || variant === 'review') && <th>Market</th>}
            {variant === 'review' && <th>Pricing</th>}
            <th>Your Price</th>
            {variant === 'review' && <th>Description</th>}
            {variant === 'standard' && <th>Status</th>}
            {variant === 'exported' && (
              <>
                <th>Exported</th>
                <th>Status</th>
                <th>Listing</th>
              </>
            )}
            {onRemove && <th></th>}
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            if (variant === 'review') {
              return <ReviewRow key={item.id} item={item} {...rowProps} />;
            }
            if (variant === 'exported') {
              return <ExportedRow key={item.id} item={item} {...rowProps} />;
            }
            return <StandardRow key={item.id} item={item} {...rowProps} />;
          })}
        </tbody>
      </table>
    </div>
  );
}
