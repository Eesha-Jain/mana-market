import { test, expect } from '@playwright/test';
import { clearAppStorage, registerUser } from './helpers/auth';
import {
  parsePackFromOcr,
  extractPackTypeFromBlob,
  extractSetNameFromBlob,
  isReadableLine,
  ocrTextQuality,
  suggestInitialLineSelection,
  composeQueryFromLines,
  suggestInitialLineAssignments,
  composeFromAssignments,
} from '../src/utils/photoScanner';

test.describe('photoScanner parsing', () => {
  test('rejects OCR garbage lines', () => {
    const garbage = 'A Ch —— ~- = Ss Hype = = Fe 5 = =~ Is = IEE HONCF Rol Promo PE';
    expect(ocrTextQuality(garbage)).toBe(0);
    expect(isReadableLine(garbage)).toBe(false);
  });

  test('extracts product type from clear OCR text', () => {
    expect(extractPackTypeFromBlob('SET BOOSTER\nMAGIC THE GATHERING')).toBe('Set Booster Pack');
    expect(extractPackTypeFromBlob('FOIL PROMO PACK')).toBe('Foil Promo Pack');
    expect(extractPackTypeFromBlob('PROMO PACK')).toBe('Promo Pack');
  });

  test('extracts set name from clear OCR text', () => {
    expect(extractSetNameFromBlob('DUSKMOURN\nHOUSE OF HORROR')).toBe('Duskmourn House of Horror');
    expect(extractSetNameFromBlob('DUSKMOURN')).toBe('Duskmourn');
    expect(extractSetNameFromBlob('EDGE OF ETERNITIES')).toBe('Edge of Eternities');
  });

  test('parses LOTR and Edge of Eternities without set-specific guessing', () => {
    const lotr = `
THE LORD OF THE RINGS
TALES OF MIDDLE-EARTH
SET BOOSTER
12 CARDS
MAGIC THE GATHERING
UNIVERSES BEYOND
`.trim();
    const edge = `
EDGE OF ETERNITIES
PROMO PACK
3 CARDS
MAGIC THE GATHERING
`.trim();
    const lotrResult = parsePackFromOcr(lotr);
    const edgeResult = parsePackFromOcr(edge);

    expect(lotrResult!.setName).toBe('The Lord of the Rings Tales of Middle-earth');
    expect(lotrResult!.packType).toBe('Set Booster Pack');
    expect(lotrResult!.fullTitle).not.toMatch(/Duskmourn/i);

    expect(edgeResult!.setName).toBe('Edge of Eternities');
    expect(edgeResult!.packType).toBe('Promo Pack');
    expect(edgeResult!.fullTitle).not.toMatch(/Duskmourn/i);
  });

  test('does not infer Duskmourn from noisy unrelated OCR', () => {
    const noisy = `
<= DUSKMON SKNTowsor or +7
mOUEN ron PROM
K on PRO
`.trim();
    expect(parsePackFromOcr(noisy)?.setName ?? null).not.toBe('Duskmourn');
    expect(parsePackFromOcr(noisy)?.setName ?? null).not.toBe('Duskmourn House of Horror');
  });

  test('composes listing title from clear Duskmourn OCR', () => {
    const clean = 'DUSKMOURN\nHOUSE OF HORROR\nFOIL PROMO PACK\n3 CARDS\nMAGIC THE GATHERING';
    const result = parsePackFromOcr(clean);
    expect(result).not.toBeNull();
    expect(result!.fullTitle).toBe('Duskmourn House of Horror Foil Promo Pack');
    expect(result!.confidence).toBe('high');
  });

  test('suggests initial line selection from parse', () => {
    const ocr = 'DUSKMOURN\nHOUSE OF HORROR\nFOIL PROMO PACK\n3 CARDS\nMAGIC THE GATHERING';
    const parse = parsePackFromOcr(ocr)!;
    const readable = ['DUSKMOURN', 'HOUSE OF HORROR', 'FOIL PROMO PACK', '3 CARDS'];
    const selected = suggestInitialLineSelection(readable, parse);
    expect(selected).toContain('DUSKMOURN');
    expect(selected).toContain('FOIL PROMO PACK');
    expect(selected).not.toContain('3 CARDS');
  });

  test('composeQueryFromLines joins selected text', () => {
    expect(composeQueryFromLines(['Edge Of Eternities', 'Promo Pack'])).toBe(
      'Edge Of Eternities Promo Pack',
    );
  });

  test('composeFromAssignments splits title and description', () => {
    const assignments = suggestInitialLineAssignments(
      ['DUSKMOURN', 'HOUSE OF HORROR', 'FOIL PROMO PACK', '3 CARDS'],
      parsePackFromOcr('DUSKMOURN\nHOUSE OF HORROR\nFOIL PROMO PACK\n3 CARDS')!,
    );
    const composed = composeFromAssignments(assignments);
    expect(composed.title).toMatch(/DUSKMOURN/);
    expect(composed.description).toMatch(/3 CARDS/);
  });

  test('composeFromAssignments preserves line order', () => {
    const composed = composeFromAssignments([
      { line: 'Promo Pack', target: 'title' },
      { line: 'Edge of Eternities', target: 'title' },
      { line: 'Includes 9 boosters', target: 'description' },
      { line: 'Ages 13+', target: 'description' },
    ]);
    expect(composed.title).toBe('Promo Pack Edge of Eternities');
    expect(composed.description).toBe('Includes 9 boosters\nAges 13+');
  });
});

test.describe('ocr merge', () => {
  test('pass 2 adds only novel lines', async () => {
    const { mergeOcrPasses, buildOcrPass2Prompt, compactPassLines, OCR_PASS2_FOLLOWUP_PROMPT } =
      await import('../src/utils/ocrPrompts');
    const pass1 = 'Edge of Eternities\nPromo Pack';
    const pass2 = 'Promo Pack\n3 Cards';
    expect(mergeOcrPasses(pass1, pass2)).toBe('Edge of Eternities\nPromo Pack\n3 Cards');
    expect(buildOcrPass2Prompt(pass1)).toContain('Edge of Eternities');
    expect(OCR_PASS2_FOLLOWUP_PROMPT).toContain('NONE');
    expect(compactPassLines('NONE')).toEqual([]);
  });
});

test.describe('text case', () => {
  test('applies capitalization formats', async () => {
    const { applyTextCase } = await import('../src/utils/textCase');
    expect(applyTextCase('EDGE OF ETERNITIES', 'sentence')).toBe('Edge of eternities');
    expect(applyTextCase('Hello World', 'lowercase')).toBe('hello world');
    expect(applyTextCase('Hello World', 'upper')).toBe('HELLO WORLD');
    expect(applyTextCase('Edge Of Eternities Promo', 'title')).toBe('Edge Of Eternities Promo');
    expect(applyTextCase('unchanged', 'as_detected')).toBe('unchanged');
  });
});

test.describe('photo scan e2e', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await registerUser(page, {
      name: 'Photo Tester',
      email: `photo-${Date.now()}@test.com`,
      password: 'testpass123',
    });
  });

  test('uploads pack photo and never false-labels as Duskmourn', async ({ page }) => {
    test.skip(!process.env.GEMINI_API_KEY, 'Requires GEMINI_API_KEY for live OCR');

    test.setTimeout(180_000);

    await page.goto('/upload');
    await page.getByRole('button', { name: 'Photo Scan' }).click();

    const fileInput = page.locator('.photo-scan-area input[type="file"]').first();
    await fileInput.setInputFiles('tests/fixtures/lotr-set-booster.png');

    await expect(page.getByText('Reading label…')).toBeHidden({ timeout: 120_000 });

    const pageText = await page.locator('.tab-content').innerText();
    expect(pageText).not.toMatch(/Duskmourn House of Horror/i);
    expect(pageText).not.toMatch(/\bDuskmourn\b.*(?:Set Booster|Promo Pack|Foil Promo)/i);
  });
});
