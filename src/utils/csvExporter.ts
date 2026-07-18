import type { UserItemWithCatalog } from '../types';
import { calculatePrice, getItemMarketPrice } from './ebayMapper';
import { getItemTitle, getItemListingDescription, getItemImageUrl, getItemProduct } from './items';

export interface CsvColumnDef {
  id: string;
  label: string;
  defaultHeader: string;
  getValue: (item: UserItemWithCatalog) => string;
}

export const CSV_COLUMNS: CsvColumnDef[] = [
  {
    id: 'listing_id',
    label: 'Listing ID',
    defaultHeader: 'Listing ID',
    getValue: item => item.referenceId,
  },
  {
    id: 'name',
    label: 'Product Name',
    defaultHeader: 'Product Name',
    getValue: item => getItemTitle(item),
  },
  {
    id: 'brand',
    label: 'Brand',
    defaultHeader: 'Brand',
    getValue: item => getItemProduct(item)?.brand ?? '',
  },
  {
    id: 'upc',
    label: 'UPC',
    defaultHeader: 'UPC',
    getValue: item => getItemProduct(item)?.upc ?? item.originalUpc ?? '',
  },
  {
    id: 'sku',
    label: 'SKU',
    defaultHeader: 'SKU',
    getValue: item => item.originalSku ?? '',
  },
  {
    id: 'condition',
    label: 'Condition',
    defaultHeader: 'Condition',
    getValue: item => item.condition ?? '',
  },
  {
    id: 'quantity',
    label: 'Quantity',
    defaultHeader: 'Quantity',
    getValue: item => String(item.quantity),
  },
  {
    id: 'market_price',
    label: 'Market Price',
    defaultHeader: 'Market Price',
    getValue: item => {
      const p = getItemMarketPrice(item);
      return p !== null ? p.toFixed(2) : '';
    },
  },
  {
    id: 'list_price',
    label: 'Your Price',
    defaultHeader: 'List Price',
    getValue: item => {
      const p = calculatePrice(item);
      return p !== null ? p.toFixed(2) : '';
    },
  },
  {
    id: 'notes',
    label: 'Notes',
    defaultHeader: 'Notes',
    getValue: item => getItemListingDescription(item),
  },
  {
    id: 'description',
    label: 'Description',
    defaultHeader: 'Description',
    getValue: item => getItemListingDescription(item) || getItemProduct(item)?.description || '',
  },
  {
    id: 'image_url',
    label: 'Image URL',
    defaultHeader: 'Image URL',
    getValue: item => getItemImageUrl(item) ?? '',
  },
  {
    id: 'ebay_url',
    label: 'eBay Search URL',
    defaultHeader: 'eBay URL',
    getValue: item => getItemProduct(item)?.ebaySearchUrl ?? '',
  },
  {
    id: 'tcgplayer_url',
    label: 'TCGplayer URL',
    defaultHeader: 'TCGplayer URL',
    getValue: item => getItemProduct(item)?.tcgplayerUrl ?? '',
  },
];

export interface CsvExportConfig {
  columnIds: string[];
  headers: Record<string, string>;
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildCsvContent(items: UserItemWithCatalog[], config: CsvExportConfig): string {
  const columns = config.columnIds
    .map(id => CSV_COLUMNS.find(c => c.id === id))
    .filter((c): c is CsvColumnDef => !!c);

  const headerRow = columns
    .map(c => escapeCsvField(config.headers[c.id] ?? c.defaultHeader))
    .join(',');

  const dataRows = items.map(item =>
    columns.map(c => escapeCsvField(c.getValue(item))).join(','),
  );

  return [headerRow, ...dataRows].join('\r\n');
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
