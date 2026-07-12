'use client';

import type { MouseEvent } from 'react';
import type { ItemListing } from '@/types';
import {
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
import { ConditionQuantityFields } from '../ConditionQuantityFields';
import { ListingPricingFields } from '../ListingPricingFields';
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
        <span className="text-muted-sm" style={{ fontSize: '0.72rem' }}>
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
    <ConditionQuantityFields
      variant="inline"
      fields={['condition']}
      condition={item.condition}
      quantity={item.quantity}
      onConditionChange={condition => update({ condition })}
      onQuantityChange={() => {}}
    />
  );
}

export function ReviewQuantityCell({ item, ctx }: { item: ItemListing; ctx: ItemTableContext }) {
  const update = itemUpdate(ctx, item);
  return (
    <ConditionQuantityFields
      variant="inline"
      fields={['quantity']}
      condition={item.condition}
      quantity={item.quantity}
      onConditionChange={() => {}}
      onQuantityChange={quantity => update({ quantity })}
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
        <span className="text-muted-sm" style={{ display: 'block', fontSize: '0.72rem' }}>
          {getMarketPriceSourceLabel(marketSelection.source, 'short')}
        </span>
      )}
      {product?.priceRange && (
        <span className="text-muted-sm" style={{ display: 'block', fontSize: '0.72rem' }}>
          ${product.priceRange.low}–${product.priceRange.high}
        </span>
      )}
    </>
  );
}

export function ReviewPricingCell({ item, ctx }: { item: ItemListing; ctx: ItemTableContext }) {
  const update = itemUpdate(ctx, item);
  return (
    <ListingPricingFields
      variant="inline"
      marketPrice={getItemMarketPrice(item)}
      pricingMode={item.pricingMode}
      percentBelow={item.percentBelow}
      manualPrice={item.manualPrice}
      finalPrice={calculatePrice(item)}
      onPricingModeChange={pricingMode => update({ pricingMode })}
      onPercentBelowChange={percentBelow => update({ percentBelow })}
      onManualPriceChange={manualPrice => update({ manualPrice })}
    />
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
