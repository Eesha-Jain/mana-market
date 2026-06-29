import { test, expect } from '@playwright/test';
import {
  parseTableText,
  parseTableRaw,
  applyColumnMappings,
  getQueryFromRow,
  isBarcode,
  normalizeCondition,
} from '../src/utils/csvParser';
import { SAMPLE_CSV_COMMA, SAMPLE_CSV_TSV } from './helpers/sampleData';

test.describe('csvParser', () => {
  test('parses tab-separated spreadsheet paste', () => {
    const rows = parseTableText(SAMPLE_CSV_TSV);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.name).toBe('Modern Horizons 3 Booster Box');
    expect(rows[0]!.sku).toBe('630509777771');
    expect(rows[0]!.quantity).toBe('2');
    expect(rows[0]!.condition).toBe('NM');
  });

  test('parses comma-separated CSV with quoted fields', () => {
    const rows = parseTableText(SAMPLE_CSV_COMMA);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.name).toBe('Modern Horizons 3 Booster Box');
    expect(rows[1]!.name).toBe('Totally Unknown Sealed Product XYZ');
  });

  test('maps alternate header names including separate UPC column', () => {
    const text = 'Product\tUPC\tQty\tCond\nMH3 Box\t1234567890123\t3\tmint';
    const rows = parseTableText(text);
    expect(rows[0]!.name).toBe('MH3 Box');
    expect(rows[0]!.upc).toBe('1234567890123');
    expect(rows[0]!.quantity).toBe('3');
    expect(rows[0]!.condition).toBe('mint');
  });

  test('builds composite sku from set and collector number', () => {
    const text = 'Name\tSet Code\t#\nLightning Bolt\tMH3\t123';
    const rows = parseTableText(text);
    expect(rows[0]!.sku).toBe('MH3/123');
  });

  test('returns empty array for single-line input', () => {
    expect(parseTableText('Name\tSKU')).toEqual([]);
  });

  test('getQueryFromRow uses name for display when both name and UPC present', () => {
    expect(getQueryFromRow({ name: 'MH3 Booster Box', sku: '630509777771' })).toBe('MH3 Booster Box');
  });

  test('getQueryFromRow falls back to sku when name missing', () => {
    expect(getQueryFromRow({ sku: '630509777771' })).toBe('630509777771');
    expect(getQueryFromRow({ sku: 'MH3/123' })).toBe('MH3/123');
  });

  test('isBarcode recognizes UPC lengths', () => {
    expect(isBarcode('630509777771')).toBe(true);
    expect(isBarcode('1234567')).toBe(false);
    expect(isBarcode('abc123')).toBe(false);
    expect(isBarcode('12345678901234')).toBe(true);
  });

  test('normalizeCondition maps MTG grades to eBay conditions', () => {
    expect(normalizeCondition('NM')).toBe('Like New');
    expect(normalizeCondition('near mint')).toBe('Like New');
    expect(normalizeCondition('LP')).toBe('Very Good');
    expect(normalizeCondition('MP')).toBe('Good');
    expect(normalizeCondition('HP')).toBe('Acceptable');
    expect(normalizeCondition('DMG')).toBe('For Parts or Not Working');
    expect(normalizeCondition('New')).toBe('New');
  });

  test('normalizeCondition returns null for unknown values', () => {
    expect(normalizeCondition('')).toBeNull();
    expect(normalizeCondition('???')).toBeNull();
  });

  test('flags unrecognized columns instead of storing them on rows', () => {
    const text = 'Name\tFinish\tQuantity\nMH3 Box\tFoil\t2';
    const parsed = parseTableRaw(text);
    expect(parsed?.unrecognizedHeaders).toEqual(['Finish']);
    expect(parseTableText(text)).toEqual([{ name: 'MH3 Box', quantity: '2' }]);
  });

  test('applyColumnMappings can map unrecognized columns or discard them', () => {
    const text = 'Name\tFinish\tNotes\nMH3 Box\tFoil\tSealed';
    const parsed = parseTableRaw(text)!;

    const mapped = applyColumnMappings(parsed, { Finish: 'notes' });
    expect(mapped[0]!.notes).toBe('Foil');

    const withFinish = applyColumnMappings(parsed, { Finish: 'condition' });
    expect(withFinish[0]!.condition).toBe('Foil');

    const discarded = applyColumnMappings(parsed, { Finish: 'discard' });
    expect(discarded[0]!.notes).toBe('Sealed');
    expect(discarded[0]).not.toHaveProperty('finish');
  });
});
