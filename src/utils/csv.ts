import type { CSVRow, EbayCondition, UserItemWithCatalog } from '../types';
import { calculateDraftPrice, resolveItemMarketPrice } from './pricing';
import { getItemTitle, getItemListingDescription, getItemImageUrl } from './items';
import { getLookupFromRow } from './search';

export { isBarcode } from './search';

/** Canonical spreadsheet columns the app understands. */
export const CSV_COLUMN_KEYS = [
  'name',
  'sku',
  'upc',
  'set',
  'collector_number',
  'quantity',
  'condition',
  'notes',
  'price',
] as const;

export type CSVColumnKey = (typeof CSV_COLUMN_KEYS)[number];

export const CSV_COLUMN_LABELS: Record<CSVColumnKey, string> = {
  name: 'Name',
  sku: 'SKU',
  upc: 'UPC',
  set: 'Set code',
  collector_number: 'Collector number',
  quantity: 'Quantity',
  condition: 'Condition',
  notes: 'Notes',
  price: 'Price',
};

export type ColumnMappingChoice = CSVColumnKey | 'discard';

export interface RawParsedTable {
  originalHeaders: string[];
  unrecognizedHeaders: string[];
  autoMapped: Record<string, CSVColumnKey>;
  rawRows: Record<string, string>[];
}

const CANONICAL_KEYS = new Set<string>(CSV_COLUMN_KEYS);

// Maps common column header variations to our canonical keys
const HEADER_MAP: Record<string, CSVColumnKey> = {
  name: 'name', 'card name': 'name', card_name: 'name', cardname: 'name',
  title: 'name', item: 'name', product: 'name',
  sku: 'sku', product_id: 'sku', scryfall_id: 'sku',
  upc: 'upc', barcode: 'upc',
  'set code': 'set', set_code: 'set', set: 'set',
  'collector number': 'collector_number', collector_number: 'collector_number',
  collector: 'collector_number', number: 'collector_number', '#': 'collector_number',
  quantity: 'quantity', qty: 'quantity', count: 'quantity', copies: 'quantity', amount: 'quantity',
  condition: 'condition', cond: 'condition', grade: 'condition', quality: 'condition',
  notes: 'notes', note: 'notes', comments: 'notes', comment: 'notes', description: 'notes',
  price: 'price', asking_price: 'price', list_price: 'price', sale_price: 'price',
};

function resolveAutoMap(header: string): CSVColumnKey | null {
  const lower = header.toLowerCase().trim().replace(/\s+/g, ' ');
  if (HEADER_MAP[lower]) return HEADER_MAP[lower];
  const underscored = lower.replace(/\s+/g, '_');
  if (CANONICAL_KEYS.has(underscored)) return underscored as CSVColumnKey;
  return null;
}

function normalizeHeaderToken(value: string): string {
  return value.toLowerCase().trim().replace(/^\ufeff/, '').replace(/\s+/g, ' ');
}

/** True when a data row is clearly another copy of the header (or only header labels). */
function isHeaderLikeRow(values: string[], headers: string[]): boolean {
  const normalizedHeaders = headers.map(normalizeHeaderToken).filter(Boolean);
  const normalizedValues = values.map(normalizeHeaderToken);

  if (!normalizedHeaders.length) return false;

  // Exact duplicate of the header row (common when sheets are copy-pasted twice).
  const aligned = normalizedValues.slice(0, normalizedHeaders.length);
  if (
    aligned.length === normalizedHeaders.length &&
    aligned.every((value, i) => value === normalizedHeaders[i])
  ) {
    return true;
  }

  // Most cells are known column labels (e.g. title / quantity / condition).
  const nonEmpty = normalizedValues.filter(Boolean);
  if (nonEmpty.length < 2) return false;
  const headerLikeCount = nonEmpty.filter(value => resolveAutoMap(value) != null).length;
  return headerLikeCount >= Math.ceil(nonEmpty.length * 0.75) && headerLikeCount >= 2;
}

/** True when a mapped CSV row still looks like column headers instead of a product. */
export function isHeaderLikeCsvRow(row: CSVRow): boolean {
  const candidates = [
    row.name,
    row.sku,
    row.upc,
    row.quantity,
    row.condition,
    row.notes,
    row.price,
    row.set,
    row.collector_number,
  ]
    .map(v => normalizeHeaderToken(v ?? ''))
    .filter(Boolean);

  if (candidates.length < 2) {
    // Single-field "Title" / "Name" / "Quantity" rows are almost never real products.
    if (candidates.length === 1 && resolveAutoMap(candidates[0]!) != null) return true;
    return false;
  }

  const headerLikeCount = candidates.filter(value => resolveAutoMap(value) != null).length;
  return headerLikeCount >= Math.ceil(candidates.length * 0.75) && headerLikeCount >= 2;
}

function detectSeparator(firstLine: string): '\t' | ',' {
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs >= commas ? '\t' : ',';
}

function parseTSVLine(line: string): string[] {
  return line.split('\t').map(s => s.trim());
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Parse spreadsheet text without applying user mappings for unrecognized headers. */
export function parseTableRaw(text: string): RawParsedTable | null {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) return null;

  const sep = detectSeparator(lines[0]!);
  const parseLine = sep === '\t' ? parseTSVLine : parseCSVLine;

  const originalHeaders = parseLine(lines[0]!)
    .map(h => h.replace(/^\ufeff/, '').trim())
    .filter(Boolean);
  if (!originalHeaders.length) return null;

  const autoMapped: Record<string, CSVColumnKey> = {};
  const unrecognizedHeaders: string[] = [];

  for (const header of originalHeaders) {
    const canonical = resolveAutoMap(header);
    if (canonical) autoMapped[header] = canonical;
    else unrecognizedHeaders.push(header);
  }

  const rawRows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]!);
    if (isHeaderLikeRow(values, originalHeaders)) continue;

    const row: Record<string, string> = {};
    originalHeaders.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    rawRows.push(row);
  }

  if (!rawRows.length) return null;

  return { originalHeaders, unrecognizedHeaders, autoMapped, rawRows };
}

function finalizeCSVRow(row: CSVRow): CSVRow {
  if (row.set && row.collector_number && !row.sku) {
    return { ...row, sku: `${row.set}/${row.collector_number}` };
  }
  return row;
}

/** Build effective header → canonical map from auto-detected and user mappings. */
export function buildHeaderToCanonicalMap(
  parsed: RawParsedTable,
  userMappings: Record<string, ColumnMappingChoice>,
): Map<string, CSVColumnKey> {
  const headerToCanonical = new Map<string, CSVColumnKey>();

  for (const [header, canonical] of Object.entries(parsed.autoMapped)) {
    headerToCanonical.set(header, canonical);
  }

  for (const header of parsed.unrecognizedHeaders) {
    const choice = userMappings[header] ?? 'discard';
    if (choice !== 'discard') {
      headerToCanonical.set(header, choice);
    }
  }

  return headerToCanonical;
}

/** Join values from multiple columns mapped to the same field (deduped, file order). */
function combineMappedValues(key: CSVColumnKey, values: string[]): string {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const norm = trimmed.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    unique.push(trimmed);
  }

  if (unique.length === 0) return '';
  if (unique.length === 1) return unique[0]!;

  if (key === 'quantity') {
    const nums = unique
      .map(v => parseInt(v.replace(/,/g, ''), 10))
      .filter(n => !Number.isNaN(n));
    if (nums.length > 0) return String(nums.reduce((a, b) => a + b, 0));
  }

  if (key === 'price') {
    return unique[0]!;
  }

  const sep = key === 'notes' ? '; ' : ' ';
  return unique.join(sep);
}

/** Warn when multiple columns map to the same canonical field (values are combined). */
export function getDuplicateMappingWarnings(
  parsed: RawParsedTable,
  userMappings: Record<string, ColumnMappingChoice>,
): string[] {
  const headerToCanonical = buildHeaderToCanonicalMap(parsed, userMappings);
  const canonicalToHeaders = new Map<CSVColumnKey, string[]>();

  for (const header of parsed.originalHeaders) {
    const canonical = headerToCanonical.get(header);
    if (!canonical) continue;
    const list = canonicalToHeaders.get(canonical) ?? [];
    list.push(header);
    canonicalToHeaders.set(canonical, list);
  }

  const warnings: string[] = [];
  for (const [canonical, headers] of canonicalToHeaders) {
    if (headers.length <= 1) continue;
    const how =
      canonical === 'quantity'
        ? 'Quantities will be summed.'
        : canonical === 'price'
          ? `Only the first non-empty value ("${headers[0]}") will be used for price.`
          : 'Their values will be combined.';
    warnings.push(
      `Multiple columns map to ${CSV_COLUMN_LABELS[canonical]} (${headers.join(', ')}). ${how}`,
    );
  }
  return warnings;
}

/** Apply auto-detected and user-chosen column mappings to raw parsed rows. */
export function applyColumnMappings(
  parsed: RawParsedTable,
  userMappings: Record<string, ColumnMappingChoice>,
): CSVRow[] {
  const headerToCanonical = buildHeaderToCanonicalMap(parsed, userMappings);
  const valuesByCanonical = new Map<CSVColumnKey, string[]>();

  for (const header of parsed.originalHeaders) {
    const canonical = headerToCanonical.get(header);
    if (!canonical) continue;
    const list = valuesByCanonical.get(canonical) ?? [];
    list.push(header);
    valuesByCanonical.set(canonical, list);
  }

  return parsed.rawRows
    .map(rawRow => {
      const row: CSVRow = {};

      for (const [canonical, headers] of valuesByCanonical) {
        const parts = headers.map(header => rawRow[header] ?? '');
        const combined = combineMappedValues(canonical, parts);
        if (combined) row[canonical] = combined;
      }

      return finalizeCSVRow(row);
    })
    .filter(row => !isHeaderLikeCsvRow(row));
}

export function parseTableText(
  text: string,
  userMappings: Record<string, ColumnMappingChoice> = {},
): CSVRow[] {
  const parsed = parseTableRaw(text);
  if (!parsed) return [];
  return applyColumnMappings(parsed, userMappings);
}

export const parseCSVText = parseTableText;

export async function parseCSVFile(file: File): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try { resolve(parseTableText(e.target?.result as string)); }
      catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export async function parseCSVFileRaw(file: File): Promise<RawParsedTable | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try { resolve(parseTableRaw(e.target?.result as string)); }
      catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/** Display label for a CSV row (name when present, otherwise SKU/UPC). */
export function getQueryFromRow(row: CSVRow): string {
  return getLookupFromRow(row).query;
}

export function normalizeCondition(value: string): EbayCondition | null {
  const v = value.toLowerCase().trim().replace(/[^a-z ]/g, '');
  if (!v) return null;

  if (['nm', 'near mint', 'mint', 'm', 'near mint mint'].includes(v)) return 'Like New';
  if (['lp', 'lightly played', 'light played', 'ex', 'excellent', 'played'].includes(v)) return 'Very Good';
  if (['mp', 'moderately played', 'mod played', 'vg'].includes(v)) return 'Good';
  if (['hp', 'heavily played', 'heavy played'].includes(v)) return 'Acceptable';
  if (['dmg', 'damaged', 'poor', 'dm'].includes(v)) return 'For Parts or Not Working';
  if (v === 'new') return 'New';
  if (v.includes('like new')) return 'Like New';
  if (v.includes('very good')) return 'Very Good';
  if (v.includes('good') && !v.includes('very')) return 'Good';
  if (v.includes('acceptable')) return 'Acceptable';
  if (v.includes('for parts')) return 'For Parts or Not Working';

  return null;
}

export function defaultColumnMappings(headers: string[]): Record<string, ColumnMappingChoice> {
  return Object.fromEntries(headers.map(header => [header, 'discard']));
}
// --- export ---

export interface CsvColumnDef {
  id: string;
  label: string;
  defaultHeader: string;
  getValue: (item: UserItemWithCatalog) => string;
}

export const CSV_COLUMNS: CsvColumnDef[] = [
  {
    id: 'reference_id',
    label: 'Reference ID',
    defaultHeader: 'Reference ID',
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
    getValue: item => item.catalog?.catalogSnapshot.brand ?? '',
  },
  {
    id: 'upc',
    label: 'UPC',
    defaultHeader: 'UPC',
    getValue: item => item.catalog?.upc ?? item.originalUpc ?? '',
  },
  {
    id: 'sku',
    label: 'SKU',
    defaultHeader: 'SKU',
    getValue: item => item.originalSku ?? '',
  },
  {
    id: 'category',
    label: 'Category',
    defaultHeader: 'Category',
    getValue: item => item.category ?? item.catalog?.defaultCategory ?? '',
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
      const p = resolveItemMarketPrice(item);
      return p !== null ? p.toFixed(2) : '';
    },
  },
  {
    id: 'list_price',
    label: 'Your Price',
    defaultHeader: 'List Price',
    getValue: item => {
      const market = resolveItemMarketPrice(item);
      const p = calculateDraftPrice(market, {
        pricingMode: item.pricingMode,
        percentBelow: item.percentBelow,
        manualPrice: item.price,
      });
      return (p ?? item.price) > 0 ? (p ?? item.price).toFixed(2) : '';
    },
  },
  {
    id: 'notes',
    label: 'Notes',
    defaultHeader: 'Notes',
    getValue: item => item.notes,
  },
  {
    id: 'description',
    label: 'Description',
    defaultHeader: 'Description',
    getValue: item => getItemListingDescription(item) || item.catalog?.description || '',
  },
  {
    id: 'image_url',
    label: 'Image URL',
    defaultHeader: 'Image URL',
    getValue: item => getItemImageUrl(item) ?? '',
  },
  {
    id: 'amazon_url',
    label: 'Amazon Search URL',
    defaultHeader: 'Amazon URL',
    getValue: item => {
      const title = getItemTitle(item);
      return `https://www.amazon.com/s?k=${encodeURIComponent(title)}`;
    },
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
