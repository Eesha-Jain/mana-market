/** How to capitalize listing text — `as_detected` leaves OCR output unchanged. */
export type TextCaseFormat = 'as_detected' | 'lowercase' | 'sentence' | 'title' | 'upper';

export const TEXT_CASE_OPTIONS: { value: TextCaseFormat; label: string }[] = [
  { value: 'as_detected', label: 'As detected (no change)' },
  { value: 'sentence', label: 'Sentence case' },
  { value: 'title', label: 'Title Case' },
  { value: 'lowercase', label: 'lowercase' },
  { value: 'upper', label: 'ALL CAPS' },
];

export const TEXT_CASE_TOOLBAR: { value: Exclude<TextCaseFormat, 'as_detected'>; label: string; title: string }[] = [
  { value: 'lowercase', label: 'abc', title: 'lowercase' },
  { value: 'sentence', label: 'Abc', title: 'Sentence case' },
  { value: 'title', label: 'Aa Bb', title: 'Title Case' },
  { value: 'upper', label: 'ABC', title: 'ALL CAPS' },
];

function sentenceCaseLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function titleCaseLine(line: string): string {
  return line
    .trim()
    .split(/([\s_-]+)/)
    .map(part => {
      if (/^[\s_-]+$/.test(part)) return part;
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}

function transformLine(line: string, format: Exclude<TextCaseFormat, 'as_detected'>): string {
  switch (format) {
    case 'lowercase':
      return line.toLowerCase();
    case 'upper':
      return line.toUpperCase();
    case 'sentence':
      return sentenceCaseLine(line);
    case 'title':
      return titleCaseLine(line);
  }
}

/** Apply a case format to text (handles multi-line descriptions). */
export function applyTextCase(text: string, format: TextCaseFormat): string {
  if (!text || format === 'as_detected') return text;

  return text
    .split(/\r?\n/)
    .map(line => transformLine(line, format))
    .join('\n');
}

/** Migrate legacy stored settings values. */
export function normalizeTextCaseFormat(value: unknown): TextCaseFormat {
  if (value === 'camel') return 'title';
  if (
    value === 'as_detected' ||
    value === 'lowercase' ||
    value === 'sentence' ||
    value === 'title' ||
    value === 'upper'
  ) {
    return value;
  }
  return 'as_detected';
}
