import type { CSVRow } from '../types';

/** UPC/EAN barcodes are 8–14 digits. */
export function isBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(value.trim());
}

export interface ProductLookupInput {
  /** Display label — product name when available, otherwise SKU/UPC or free text. */
  query: string;
  /** Numeric barcode (UPC/EAN) — catalog lookup is tried first when present. */
  originalUpc?: string;
  /** Product SKU — text-search hint (like a title), not a barcode lookup. */
  originalSku?: string;
}

function resolveNameAndIdentifier(first: string, second: string): ProductLookupInput {
  const a = first.trim();
  const b = second.trim();
  const aIsBarcode = isBarcode(a);
  const bIsBarcode = isBarcode(b);

  if (bIsBarcode && !aIsBarcode) {
    return { query: a || b, originalUpc: b };
  }
  if (aIsBarcode && !bIsBarcode) {
    return { query: b || a, originalUpc: a };
  }
  if (aIsBarcode && bIsBarcode) {
    return { query: a, originalUpc: a, originalSku: b !== a ? b : undefined };
  }

  return { query: a || b, originalSku: b || undefined };
}

/**
 * Parse a single free-text line (manual entry, bulk paste, or CSV-less row).
 * Supports bare UPC, bare SKU, product name, or "name + identifier" (tab/comma-separated).
 */
export function parseManualLookupInput(text: string): ProductLookupInput {
  const trimmed = text.trim();
  if (!trimmed) return { query: '' };

  if (isBarcode(trimmed)) {
    return { query: trimmed, originalUpc: trimmed };
  }

  const tabParts = trimmed.split(/\t/).map(p => p.trim()).filter(Boolean);
  if (tabParts.length >= 2) {
    return resolveNameAndIdentifier(tabParts[0]!, tabParts[1]!);
  }

  const commaParts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const barcode = commaParts.find(isBarcode);
    if (barcode) {
      const name = commaParts.filter(p => !isBarcode(p)).join(', ');
      return { query: name || barcode, originalUpc: barcode };
    }
    return resolveNameAndIdentifier(commaParts[0]!, commaParts.slice(1).join(', '));
  }

  return { query: trimmed };
}

/** Alias — each bulk line uses the same parsing rules as manual entry. */
export function parseBulkLine(line: string): ProductLookupInput {
  return parseManualLookupInput(line);
}

function pickBarcode(...values: string[]): string | undefined {
  return values.map(v => v.trim()).find(v => v && isBarcode(v));
}

function pickSku(skuRaw: string, upc?: string): string | undefined {
  const sku = skuRaw.trim();
  if (!sku) return undefined;
  if (upc && sku === upc) return undefined;
  if (isBarcode(sku)) return undefined;
  return sku;
}

/** Resolve lookup fields from a parsed CSV/spreadsheet row. */
export function getLookupFromRow(row: CSVRow): ProductLookupInput {
  const upcCol = (row.upc || '').trim();
  const skuCol = (row.sku || '').trim();
  const name = (row.name || '').trim();

  const originalUpc = pickBarcode(upcCol, skuCol);
  const originalSku = pickSku(skuCol, originalUpc) ?? pickSku(upcCol, originalUpc);

  const query =
    name ||
    originalSku ||
    originalUpc ||
    skuCol ||
    upcCol ||
    '';

  return { query, originalUpc, originalSku };
}

/**
 * Normalize query + optional UPC/SKU into consistent lookup fields.
 * UPC and SKU are kept separate; both may be present on the same row.
 */
export function normalizeProductLookup(
  query: string,
  identifiers: { originalUpc?: string; originalSku?: string } = {},
): ProductLookupInput {
  const trimmedQuery = query.trim();
  const trimmedUpc = identifiers.originalUpc?.trim();
  const trimmedSku = identifiers.originalSku?.trim();

  const originalUpc =
    trimmedUpc && isBarcode(trimmedUpc)
      ? trimmedUpc
      : isBarcode(trimmedQuery)
        ? trimmedQuery
        : undefined;

  const originalSku =
    trimmedSku && trimmedSku !== originalUpc && !isBarcode(trimmedSku)
      ? trimmedSku
      : undefined;

  const displayQuery =
    trimmedQuery ||
    originalSku ||
    originalUpc ||
    '';

  return { query: displayQuery, originalUpc, originalSku };
}

export interface SearchParams {
  /** Product name — text search on eBay (paired with sku for disambiguation). */
  query: string;
  upc?: string;
  /** SKU — text search hint, same role as query; used to narrow ambiguous matches. */
  sku?: string;
}

/**
 * Build API search parameters.
 * UPC is resolved in the catalog first; query and sku are both text-search hints.
 */
export function resolveSearchParams(
  query: string,
  identifiers: { originalUpc?: string; originalSku?: string } = {},
): SearchParams {
  const { query: q, originalUpc, originalSku } = normalizeProductLookup(query, identifiers);

  const fallbackTitle =
    q && q !== originalUpc && q !== originalSku ? q : undefined;

  return {
    query: fallbackTitle ?? '',
    upc: originalUpc,
    sku: originalSku,
  };
}
