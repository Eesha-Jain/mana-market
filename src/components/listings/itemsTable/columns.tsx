import { formatPrice } from '@/utils/productApi';
import { getItemMarketPrice } from '@/utils/ebayMapper';
import type { ItemTableColumnDef, ItemTableVariantConfig } from './types';
import { REVIEW_CUSTOM_ROWS } from './customRows';
import {
  EbayListingLink,
  EbayStatusCell,
  ExportedProductCell,
  formatUpcBrandCell,
  ItemListingIdCell,
  ItemThumbCell,
  ReviewConditionCell,
  ReviewDescriptionCell,
  ReviewMarketCell,
  ReviewPricingCell,
  ReviewProductCell,
  ReviewQuantityCell,
  StandardProductCell,
  StatusBadgeCell,
  YourPriceContent,
} from './cells';

const THUMB_COLUMN: ItemTableColumnDef = {
  id: 'thumb',
  header: '',
  headerWidth: 48,
  render: item => <ItemThumbCell item={item} />,
};

const REVIEW_THUMB_COLUMN: ItemTableColumnDef = {
  ...THUMB_COLUMN,
  headerWidth: 56,
  render: item => <ItemThumbCell item={item} wrap />,
};

const ID_COLUMN: ItemTableColumnDef = {
  id: 'id',
  header: 'ID',
  headerWidth: 88,
  className: 'item-listing-id-cell',
  render: item => <ItemListingIdCell item={item} />,
};

const CONDITION_COLUMN: ItemTableColumnDef = {
  id: 'condition',
  header: 'Condition',
  render: item => item.condition ?? <span className="text-muted">Not set</span>,
};

const EXPORTED_CONDITION_COLUMN: ItemTableColumnDef = {
  id: 'condition',
  header: 'Condition',
  render: item => item.condition ?? '—',
};

const REVIEW_CONDITION_COLUMN: ItemTableColumnDef = {
  id: 'condition',
  header: 'Condition',
  stopPropagation: true,
  render: (item, ctx) => <ReviewConditionCell item={item} ctx={ctx} />,
};

const QTY_COLUMN: ItemTableColumnDef = {
  id: 'qty',
  header: 'Qty',
  render: item => item.quantity,
};

const REVIEW_QTY_COLUMN: ItemTableColumnDef = {
  id: 'qty',
  header: 'Qty',
  stopPropagation: true,
  render: (item, ctx) => <ReviewQuantityCell item={item} ctx={ctx} />,
};

const MARKET_COLUMN: ItemTableColumnDef = {
  id: 'market',
  header: 'Market',
  render: item => formatPrice(getItemMarketPrice(item)),
};

const REVIEW_MARKET_COLUMN: ItemTableColumnDef = {
  id: 'market',
  header: 'Market',
  className: 'price-cell',
  render: item => <ReviewMarketCell item={item} />,
};

const YOUR_PRICE_COLUMN: ItemTableColumnDef = {
  id: 'yourPrice',
  header: 'Your Price',
  className: 'price-cell',
  render: item => <YourPriceContent item={item} />,
};

const REVIEW_YOUR_PRICE_COLUMN: ItemTableColumnDef = {
  id: 'yourPrice',
  header: 'Your Price',
  className: 'price-cell price-cell--final',
  render: item => <YourPriceContent item={item} mutedFallback />,
};

export const STANDARD_TABLE_CONFIG: ItemTableVariantConfig = {
  columns: [
    THUMB_COLUMN,
    ID_COLUMN,
    {
      id: 'product',
      header: 'Product',
      render: item => <StandardProductCell item={item} />,
    },
    {
      id: 'upcBrand',
      header: 'UPC / Brand',
      className: 'text-muted',
      render: item => formatUpcBrandCell(item),
    },
    CONDITION_COLUMN,
    QTY_COLUMN,
    MARKET_COLUMN,
    YOUR_PRICE_COLUMN,
    {
      id: 'status',
      header: 'Status',
      render: item => <StatusBadgeCell item={item} />,
    },
  ],
  isRowClickable: (_item, ctx) => !!ctx.onRowClick,
  onRowClick: (item, ctx) => ctx.onRowClick?.(item),
};

export const EXPORTED_TABLE_CONFIG: ItemTableVariantConfig = {
  columns: [
    {
      ...THUMB_COLUMN,
      render: item => <ItemThumbCell item={item} fallback="✓" />,
    },
    ID_COLUMN,
    {
      id: 'product',
      header: 'Product',
      render: item => <ExportedProductCell item={item} />,
    },
    EXPORTED_CONDITION_COLUMN,
    QTY_COLUMN,
    YOUR_PRICE_COLUMN,
    {
      id: 'exported',
      header: 'Exported',
      className: 'text-muted-sm',
      render: item =>
        item.ebayExportedAt
          ? new Date(item.ebayExportedAt).toLocaleDateString()
          : '—',
    },
    {
      id: 'ebayStatus',
      header: 'Status',
      stopPropagation: true,
      render: (item, ctx) => <EbayStatusCell item={item} ctx={ctx} />,
    },
    {
      id: 'listing',
      header: 'Listing',
      stopPropagation: true,
      render: item => <EbayListingLink item={item} />,
    },
  ],
  rowClassName: () => 'row--ebay',
  isRowClickable: (_item, ctx) => !!ctx.onRowClick,
  onRowClick: (item, ctx) => ctx.onRowClick?.(item),
};

export const REVIEW_TABLE_CONFIG: ItemTableVariantConfig = {
  columns: [
    REVIEW_THUMB_COLUMN,
    ID_COLUMN,
    {
      id: 'product',
      header: 'Product',
      stopPropagation: true,
      render: (item, ctx) => <ReviewProductCell item={item} ctx={ctx} />,
    },
    REVIEW_CONDITION_COLUMN,
    REVIEW_QTY_COLUMN,
    REVIEW_MARKET_COLUMN,
    {
      id: 'pricing',
      header: 'Pricing',
      stopPropagation: true,
      render: (item, ctx) => <ReviewPricingCell item={item} ctx={ctx} />,
    },
    REVIEW_YOUR_PRICE_COLUMN,
    {
      id: 'description',
      header: 'Description',
      stopPropagation: true,
      render: (item, ctx) => <ReviewDescriptionCell item={item} ctx={ctx} />,
    },
  ],
  customRows: REVIEW_CUSTOM_ROWS,
  isRowClickable: (_item, ctx) => !!ctx.onRowClick,
  onRowClick: (item, ctx) => ctx.onRowClick?.(item),
};

export const TABLE_CONFIGS = {
  standard: STANDARD_TABLE_CONFIG,
  review: REVIEW_TABLE_CONFIG,
  exported: EXPORTED_TABLE_CONFIG,
} as const;
