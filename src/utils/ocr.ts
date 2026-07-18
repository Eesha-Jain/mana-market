import type { Product } from '../types';
import { getAccessToken } from '@/lib/supabase/client';
import { fetchWithTimeout } from './search';
import { searchProduct } from './search';
import { inferProductTypeFromText } from './items';

export const UPC_OCR_PROMPT =
  'Read the UPC or EAN barcode from this product packaging image.\n' +
  'The barcode is the black vertical lines with a numeric code printed underneath (often 12 digits for U.S. products).\n' +
  'Output ONLY the numeric barcode digits (8–14 digits), with no spaces, dashes, or other text.\n' +
  'If no barcode is clearly visible, reply exactly: NONE';

/** Pass 1: MTG-aware — capture every readable label element for user pick-and-choose. */
export const OCR_PASS1_PROMPT =
  'Read this Magic: The Gathering product label. Use MTG set/product knowledge to decipher stylized, thematic, or distorted fonts.\n' +
  'Output plain text only — one distinct label element per line, no markdown or categories.\n' +
  'Include ALL visible text: main titles, set names, product types, brand, contents (e.g. "includes 9 boosters", card counts), age ratings, promotional lines, and other packaging text.\n' +
  'Prioritize stylized title text but do not omit smaller or secondary lines.';

/** Pass 2 follow-up when using a chat session — pass-1 text is already in history. */
export const OCR_PASS2_FOLLOWUP_PROMPT =
  'Using the same label image from above, list ANY label text you have not already output — ' +
  'especially small print, legal/auxiliary lines, age ratings, contents ("includes N boosters"), ' +
  'and stylized words missed earlier. One line per item, plain text.\n' +
  'If nothing new, reply exactly: NONE';

/** Pass 2 standalone prompt when not using chat history (repeats pass-1 lines as text). */
export function buildOcrPass2Prompt(pass1Text: string): string {
  const captured = compactPassLines(pass1Text);
  const block = captured.length ? captured.join('\n') : '(nothing yet)';

  return (
    'Pass 1 already captured:\n' +
    `${block}\n\n` +
    'Review the image. Output ONLY additional label text NOT listed above. One line per item, plain text.\n' +
    'If nothing new, reply exactly: NONE'
  );
}

/** Normalize pass output into individual lines for deduping and pass-2 context. */
export function compactPassLines(text: string): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw
      .replace(/^[-*•]\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .trim();
    if (!line || /^none$/i.test(line)) continue;

    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }

  return lines;
}

/** Merge pass 1 + pass 2; pass 2 should only add novel lines. */
export function mergeOcrPasses(pass1Text: string, pass2Text: string): string {
  const merged = [...compactPassLines(pass1Text)];

  for (const line of compactPassLines(pass2Text)) {
    if (!merged.some(existing => existing.toLowerCase() === line.toLowerCase())) {
      merged.push(line);
    }
  }

  return merged.join('\n');
}

const DEFAULT_MAX_EDGE = 1600;
const JPEG_QUALITY = 0.88;

function ocrMaxEdge(): number {
  const raw = process.env.NEXT_PUBLIC_GEMINI_OCR_MAX_EDGE;
  if (!raw) return DEFAULT_MAX_EDGE;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 640 ? n : DEFAULT_MAX_EDGE;
}

/**
 * Apply EXIF orientation and downscale for fewer vision tokens.
 * Returns a JPEG File suitable for Gemini OCR.
 */
export async function preprocessImageForOcr(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  try {
    const maxEdge = ocrMaxEdge();
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('Failed to encode image'))),
        'image/jpeg',
        JPEG_QUALITY,
      );
    });

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}
// --- gemini client ---

export class OcrError extends Error {
  constructor(
    message: string,
    readonly code: 'NOT_CONFIGURED' | 'API' | 'NETWORK' | 'EMPTY',
  ) {
    super(message);
    this.name = 'OcrError';
  }
}

async function blobToBase64(blob: Blob): Promise<{ base64: string; mimeType: string }> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return {
    base64: btoa(binary),
    mimeType: blob.type || 'image/jpeg',
  };
}

async function callOcrApi(
  mode: 'label' | 'upc',
  file: File,
  onProgress?: (message: string) => void,
): Promise<string> {
  onProgress?.('Straightening photo…');
  const prepared = await preprocessImageForOcr(file);
  const { base64, mimeType } = await blobToBase64(prepared);

  let res: Response;
  try {
    const token = await getAccessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    res = await fetchWithTimeout('/api/ocr', {
      method: 'POST',
      headers,
      body: JSON.stringify({ mode, image: base64, mimeType }),
      timeoutMs: 60_000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new OcrError(msg, 'NETWORK');
  }

  const payload = (await res.json().catch(() => ({}))) as { text?: string; error?: string; detail?: string };

  if (res.status === 503) {
    throw new OcrError(
      payload.detail || 'OCR is not configured on the server. Set GEMINI_API_KEY and restart.',
      'NOT_CONFIGURED',
    );
  }

  if (!res.ok) {
    throw new OcrError(payload.detail || payload.error || `OCR failed (HTTP ${res.status})`, 'API');
  }

  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  if (!text) {
    throw new OcrError('OCR returned no usable text.', 'EMPTY');
  }

  return text;
}

/**
 * Two-pass label OCR via the server (Gemini API key stays server-side).
 * Image is EXIF-corrected and downscaled in the browser before upload.
 */
export async function extractTextFromImage(
  file: File,
  onProgress?: (message: string) => void,
): Promise<string> {
  onProgress?.('Reading label (1/2)…');
  const text = await callOcrApi('label', file, onProgress);
  onProgress?.('Reading label (2/2)…');
  return text;
}

/** Extract UPC/EAN digits from a barcode photo via the server OCR API. */
export async function extractUpcFromImage(
  file: File,
  onProgress?: (message: string) => void,
): Promise<string> {
  return callOcrApi('upc', file, onProgress);
}
// --- photo scanner ---

export interface PackParseResult {
  setName: string | null;
  packType: string | null;
  cardCount: string | null;
  fullTitle: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface PhotoScanResult {
  ocrText: string;
  /** Clean, readable lines straight from OCR — for user pick-and-choose. */
  readableLines: string[];
  detectedLines: string[];
  searchQueries: string[];
  parse: PackParseResult | null;
  searchQuery: string | null;
  matchType: 'found' | 'ambiguous' | 'not_found' | 'no_text' | 'composed';
  product?: Product;
  candidates?: Product[];
  suggestedProduct?: Product;
}

// ─── Label vocabulary (literal OCR matches only) ─────────────────────────────

const NOISE_PATTERNS = [
  /^[\d\s©®™.+]+$/,
  /^magic[\s:]*the[\s:]*gathering$/i,
  /^tm\s*&?\s*©/i,
  /^wizards\s+of\s+the\s+coast/i,
  /^\d+\s*cards?$/i,
  /^\d+\+$/,
  /^ages?\s+\d+/i,
  /^©\d{4}/,
  /^[A-Z]{1,3}$/,
  /^planeswalker/i,
  /^\d+\/\d+$/,
  /^mtg$/i,
  /^the\s+gathering$/i,
  /^universes?\s+beyond$/i,
];

/** Set names when OCR reads them clearly — no fuzzy / set-specific guessing. */
const KNOWN_SET_PATTERNS: { pattern: RegExp; label: string }[] = [
  {
    pattern: /lord\s*of\s*the\s*rings|tales\s*of\s*middle[\s-]*earth|middle[\s-]*earth/i,
    label: 'The Lord of the Rings Tales of Middle-earth',
  },
  { pattern: /edge\s*of\s*eternit/i, label: 'Edge of Eternities' },
  { pattern: /duskmourn\s*house\s*of\s*horror|duskmourn\s*:\s*house\s*of\s*horror/i, label: 'Duskmourn House of Horror' },
  { pattern: /\bduskmourn\b/i, label: 'Duskmourn' },
];

const PRODUCT_TYPE_LINE = /^(set\s*booster|promo\s*pack|foil\s*promo\s*pack|booster\s*pack|booster\s*box|commander\s*deck)$/i;

// ─── Line quality & cleanup ───────────────────────────────────────────────────

function cleanOcrLine(line: string): string {
  return line
    .replace(/[|{}[\]\\©®™"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Score how readable a line is — filters OCR garbage like "= ~ — Fe 5 =". */
export function ocrTextQuality(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length < 3) return 0;

  const letters = (trimmed.match(/[a-zA-Z]/g) || []).length;
  const digits = (trimmed.match(/\d/g) || []).length;
  const junk = (trimmed.match(/[~=\-_—|<>^`'"\\]/g) || []).length;
  const meaningful = letters + digits;
  if (meaningful < trimmed.length * 0.35) return 0;
  if (junk > 2 && junk > letters * 0.25) return 0;

  const words = trimmed.split(/\s+/).filter(w => /[a-zA-Z]{3,}/.test(w));
  return meaningful + words.length * 8 - junk * 6;
}

export function isReadableLine(line: string): boolean {
  return ocrTextQuality(line) >= 20;
}

function isNoise(line: string): boolean {
  if (line.length < 2) return true;
  if (!isReadableLine(line)) return true;
  return NOISE_PATTERNS.some(p => p.test(line));
}

export function extractReadableLines(ocrText: string): string[] {
  return extractLabelLines(ocrText);
}

/** All OCR lines suitable for user pick-and-choose (minimal filtering). */
export function extractLabelLines(ocrText: string): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const raw of ocrText.split(/\r?\n/)) {
    const line = cleanOcrLine(raw);
    if (line.length < 2) continue;
    if (ocrTextQuality(line) <= 0) continue;

    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }

  return lines;
}

function getReadableLines(ocrText: string): string[] {
  return ocrText
    .split(/\r?\n/)
    .map(cleanOcrLine)
    .filter(line => line.length > 0 && !isNoise(line));
}

/** Pre-select label lines that likely belong in the listing title. */
export function suggestInitialLineSelection(
  readableLines: string[],
  parse: PackParseResult | null,
): string[] {
  const selected = new Set<string>();

  if (parse) {
    for (const line of readableLines) {
      const flat = line.toLowerCase();
      if (parse.setName) {
        const setWords = parse.setName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        if (setWords.some(w => flat.includes(w))) selected.add(line);
      }
      if (parse.packType) {
        const typeWords = parse.packType.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        if (typeWords.some(w => flat.includes(w))) selected.add(line);
      }
      if (inferProductTypeFromText(line)) selected.add(line);
    }
  }

  if (selected.size > 0) return [...selected];

  if (readableLines.length <= 4) return [...readableLines];

  return [...readableLines]
    .sort((a, b) => ocrTextQuality(b) - ocrTextQuality(a))
    .slice(0, 2);
}

export function composeQueryFromLines(lines: string[]): string {
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

export type OcrLineTarget = 'none' | 'title' | 'description';

export interface OcrLineAssignment {
  line: string;
  target: OcrLineTarget;
}

export function suggestInitialLineAssignments(
  readableLines: string[],
  parse: PackParseResult | null,
): OcrLineAssignment[] {
  const titleLines = new Set(suggestInitialLineSelection(readableLines, parse));

  return readableLines.map(line => {
    if (titleLines.has(line)) return { line, target: 'title' as const };
    return { line, target: 'description' as const };
  });
}

export function composeFromAssignments(assignments: OcrLineAssignment[]): {
  title: string;
  description: string;
} {
  const title = composeQueryFromLines(
    assignments.filter(a => a.target === 'title').map(a => a.line),
  );
  const description = assignments
    .filter(a => a.target === 'description')
    .map(a => a.line)
    .join('\n')
    .trim();
  return { title, description };
}

function titleCaseLine(line: string): string {
  const SMALL = new Set(['of', 'the', 'and', 'a', 'an', 'in', 'on', 'for']);
  return line
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && SMALL.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function scoreSetLine(line: string): number {
  let score = ocrTextQuality(line);
  if (/\bof\b/i.test(line)) score += 15;
  if (line.length >= 12) score += 10;
  if (/\b(the|tales|edge|lord|rings|eternit|middle|duskmourn|house|horror)\b/i.test(line)) score += 8;
  return score;
}

function detectCardCount(text: string): string | null {
  const m = text.match(/\b(\d+)\s*cards?\b/i);
  return m ? `${m[1]} Cards` : null;
}

// ─── Parse OCR into product fields ────────────────────────────────────────────

export function extractPackTypeFromBlob(text: string): string | null {
  return inferProductTypeFromText(text);
}

export function extractSetNameFromBlob(text: string): string | null {
  const flat = text.replace(/\s+/g, ' ');

  for (const { pattern, label } of KNOWN_SET_PATTERNS) {
    if (pattern.test(flat)) return label;
  }

  const lower = flat.toLowerCase();
  if (/\bduskmourn\b/.test(lower) && /house\s*of\s*horror/.test(lower)) {
    return 'Duskmourn House of Horror';
  }

  const lines = getReadableLines(text);
  const setLines = lines.filter(line => {
    if (PRODUCT_TYPE_LINE.test(line)) return false;
    if (inferProductTypeFromText(line)) return false;
    return line.length >= 4;
  });

  if (setLines.length === 0) return null;

  const best = setLines.sort((a, b) => scoreSetLine(b) - scoreSetLine(a))[0]!;
  for (const { pattern, label } of KNOWN_SET_PATTERNS) {
    if (pattern.test(best)) return label;
  }
  return titleCaseLine(best);
}

export function parsePackFromOcr(ocrText: string): PackParseResult | null {
  const packType = extractPackTypeFromBlob(ocrText);
  const setName = extractSetNameFromBlob(ocrText);
  const cardCount = detectCardCount(ocrText);

  const parts = [setName, packType].filter(Boolean);
  if (parts.length === 0) return null;

  const fullTitle = parts.join(' ').trim();
  let confidence: PackParseResult['confidence'] = 'low';
  if (setName && packType) confidence = 'high';
  else if (setName || packType) confidence = 'medium';

  return { setName, packType, cardCount, fullTitle, confidence };
}

export function extractNameCandidates(ocrText: string): string[] {
  const parse = parsePackFromOcr(ocrText);
  const queries = buildSearchQueries(parse, ocrText);

  const seen = new Set<string>();
  return queries.filter(q => {
    if (!q || ocrTextQuality(q) < 15) return false;
    const key = q.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSearchQueries(parse: PackParseResult | null, ocrText: string): string[] {
  const queries: string[] = [];

  if (parse) {
    queries.push(parse.fullTitle);
    queries.push(`${parse.fullTitle} MTG`);
    queries.push(`${parse.fullTitle} Magic the Gathering`);
    if (parse.setName && parse.packType) {
      queries.push(`${parse.setName} ${parse.packType}`);
      queries.push(`${parse.setName} ${parse.packType} MTG`);
    }
    if (parse.setName) {
      queries.push(parse.setName);
      queries.push(`${parse.setName} Magic the Gathering`);
    }
  }

  for (const line of getReadableLines(ocrText)) {
    queries.push(titleCaseLine(line));
  }

  return queries;
}

function productFromParse(parse: PackParseResult, photoUrl?: string): Product {
  const descParts = [
    parse.packType && `Product type: ${parse.packType}`,
    parse.cardCount && `Contents: ${parse.cardCount}`,
  ].filter(Boolean);

  return {
    title: parse.fullTitle,
    description: descParts.join('. '),
    imageUrls: photoUrl ? [photoUrl] : [],
    brand: 'Wizards of the Coast',
    marketPriceSource: 'manual',
  };
}

// ─── Main scan entry point ────────────────────────────────────────────────────

export async function scanPhotoForProduct(
  file: File,
  photoUrl?: string,
  onProgress?: (message: string) => void,
): Promise<PhotoScanResult> {
  const ocrText = await extractTextFromImage(file, onProgress);

  const parse = parsePackFromOcr(ocrText);
  const readableLines = extractReadableLines(ocrText);
  const searchQueries = buildSearchQueries(parse, ocrText);
  const detectedLines = extractNameCandidates(ocrText);

  if (!parse && detectedLines.length === 0) {
    return {
      ocrText,
      readableLines,
      detectedLines: [],
      searchQueries: [],
      parse: null,
      searchQuery: null,
      matchType: 'no_text',
    };
  }

  for (const query of searchQueries.slice(0, 8)) {
    const result = await searchProduct(query);

    if (result.type === 'found') {
      const product = enrichProductFromParse(result.product, parse, photoUrl);
      return {
        ocrText,
        readableLines,
        detectedLines,
        searchQueries,
        parse,
        searchQuery: query,
        matchType: 'found',
        product,
      };
    }

    if (result.type === 'ambiguous') {
      return {
        ocrText,
        readableLines,
        detectedLines,
        searchQueries,
        parse,
        searchQuery: query,
        matchType: 'ambiguous',
        candidates: result.results,
      };
    }
  }

  if (parse && parse.confidence !== 'low') {
    return {
      ocrText,
      readableLines,
      detectedLines,
      searchQueries,
      parse,
      searchQuery: parse.fullTitle,
      matchType: 'composed',
      suggestedProduct: productFromParse(parse, photoUrl),
    };
  }

  return {
    ocrText,
    readableLines,
    detectedLines,
    searchQueries,
    parse,
    searchQuery: searchQueries[0] ?? null,
    matchType: 'not_found',
    suggestedProduct: parse ? productFromParse(parse, photoUrl) : undefined,
  };
}

function enrichProductFromParse(
  product: Product,
  parse: PackParseResult | null,
  photoUrl?: string,
): Product {
  if (!parse) return product;

  const ocrTitle = parse.fullTitle;
  const useOcrTitle = parse.confidence === 'high';

  const imageUrls = [...product.imageUrls];
  if (photoUrl && !imageUrls.includes(photoUrl)) {
    imageUrls.unshift(photoUrl);
  }

  const descParts = [
    product.description,
    parse.packType && `Type: ${parse.packType}`,
    parse.cardCount && parse.cardCount,
  ].filter(Boolean);

  return {
    ...product,
    title: useOcrTitle ? ocrTitle : (ocrTitle.length > product.title.length ? ocrTitle : product.title),
    description: descParts.join('. ') || product.description,
    imageUrls,
  };
}
