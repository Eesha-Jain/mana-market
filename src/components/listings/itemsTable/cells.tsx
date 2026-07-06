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
import { ItemStatusBadge } from '../ItemStatusBadge';
import type { ItemTableContext } from './types';

export function stopRowClick(e: MouseEvent) {
  e.stopPropagation();
}

export function formatUpcBrandCell(item: ItemListing): string {
  const product = item.product;
  return [
    product?.upc ? `UPC: ${product.upc}` : item.originalUpc ? `UPC: ${item.originalUpc}` : null,
    item.originalSku ? `SKU: ${item.originalSku}` : null,
    !product?.upc && !item.originalUpc && !item.originalSku ? (product?.brand ?? '—') : null,
  ]
    .filter(Boolean)
    .join(' · ') || '—';
}

export function ItemThumbCell({
  item,
  fallback = '📦',
  wrap = false,
}: {
  item: ItemListing;
  fallback?: string;
  wrap?: boolean;
}) {
  const img = getItemImageUrl(item);
  const thumb = img
    ? (
      <img
        src={img}
        alt={getItemTitle(item)}
        className="table-thumb table-thumb--product"
        loading="lazy"
      />
    )
    : <div className="table-thumb table-thumb--empty">{fallback}</div>;

  if (wrap) {
    return <div className="thumb-cell">{thumb}</div>;
  }
  return thumb;
}

export function ItemListingIdCell({ item }: { item: ItemListing }) {
  return <span className="item-listing-id">{item.listingId}</span>;
}

export function YourPriceContent({ item, mutedFallback = false }: { item: ItemListing; mutedFallback?: boolean }) {
  const yourPrice = calculatePrice(item);
  if (yourPrice !== null) return `$${yourPrice.toFixed(2)}`;
  return mutedFallback ? <span className="text-muted">—</span> : '—';
}

export function RemoveItemCell({
  itemId,
  onRemove,
  stopPropagation = true,
}: {
  itemId: string;
  onRemove: (itemId: string) => void;
  stopPropagation?: boolean;
}) {
  return (
    <button
      className="btn-icon btn-danger-ghost"
      title="Remove item"
      onClick={e => {
        if (stopPropagation) e.stopPropagation();
        onRemove(itemId);
      }}
    >
      ✕
    </button>
  );
}

export function EbayListingLink({ item }: { item: ItemListing }) {
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

function itemUpdate(ctx: ItemTableContext, item: ItemListing) {
  return (updates: Partial<ItemListing>) => ctx.onUpdate?.(item.id, updates);
}

export function StandardProductCell({ item }: { item: ItemListing }) {
  return (
    <>
      <span className="item-name">{getItemTitle(item)}</span>
      {item.ebayExportedAt && (
        <span className="badge badge--gray" style={{ marginLeft: 6, fontSize: '0.7rem' }}>
          eBay
        </span>
      )}
    </>
  );
}

export function ExportedProductCell({ item }: { item: ItemListing }) {
  const listingUrl = getEbayListingUrl(item);
  return (
    <>
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
    </>
  );
}

export function ReviewProductCell({ item, ctx }: { item: ItemListing; ctx: ItemTableContext }) {
  const product = item.product;
  const productType = resolveItemProductType(item);
  const update = itemUpdate(ctx, item);

  return (
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
  );
}

export function ReviewConditionCell({ item, ctx }: { item: ItemListing; ctx: ItemTableContext }) {
  const update = itemUpdate(ctx, item);
  return (
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
  );
}

export function ReviewQuantityCell({ item, ctx }: { item: ItemListing; ctx: ItemTableContext }) {
  const update = itemUpdate(ctx, item);
  return (
    <input
      type="number"
      className="inline-input inline-input--sm"
      min={1}
      max={999}
      value={item.quantity}
      onChange={e => update({ quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
    />
  );
}

export function ReviewMarketCell({ item }: { item: ItemListing }) {
  const product = item.product;
  const market = getItemMarketPrice(item);
  const marketSelection = resolveItemMarketSelection(item);

  return (
    <>
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
    </>
  );
}

export function ReviewPricingCell({ item, ctx }: { item: ItemListing; ctx: ItemTableContext }) {
  const update = itemUpdate(ctx, item);
  return (
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
  );
}

export function ReviewDescriptionCell({ item, ctx }: { item: ItemListing; ctx: ItemTableContext }) {
  const update = itemUpdate(ctx, item);
  return (
    <input
      type="text"
      className="inline-input inline-input--wide"
      placeholder="Description…"
      value={getItemListingDescription(item)}
      onChange={e => update(patchItemListingDescription(e.target.value))}
    />
  );
}

export function EbayStatusCell({ item, ctx }: { item: ItemListing; ctx: ItemTableContext }) {
  if (ctx.onUpdate) {
    return (
      <select
        className="inline-select"
        value={item.ebayListingStatus ?? 'exported'}
        onChange={e =>
          ctx.onUpdate!(item.id, {
            ebayListingStatus: e.target.value as ItemListing['ebayListingStatus'],
          })
        }
      >
        <option value="exported">Exported</option>
        <option value="active">Active</option>
        <option value="sold">Sold</option>
        <option value="ended">Ended</option>
      </select>
    );
  }
  return item.ebayListingStatus ?? 'exported';
}

export function StatusBadgeCell({ item }: { item: ItemListing }) {
  return <ItemStatusBadge status={item.status} hasCondition={!!item.condition} />;
}
