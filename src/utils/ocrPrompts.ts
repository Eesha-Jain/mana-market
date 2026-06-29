/** Read a UPC/EAN barcode from packaging — digits only. */
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
