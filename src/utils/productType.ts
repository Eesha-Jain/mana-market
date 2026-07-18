/** MTG sealed product types detectable from OCR or listing titles. */

import type { ItemListing } from '../types';
import { getItemTitle } from './items';

const PRODUCT_TYPE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /collector\s*booster\s*display/i, label: 'Collector Booster Display' },
  { pattern: /collector\s*booster/i,           label: 'Collector Booster Pack' },
  { pattern: /set\s*booster/i,                 label: 'Set Booster Pack' },
  { pattern: /draft\s*booster|play\s*booster/i, label: 'Draft Booster Pack' },
  { pattern: /foil\s*promo\s*pack/i,            label: 'Foil Promo Pack' },
  { pattern: /promo\s*pack/i,                   label: 'Promo Pack' },
  { pattern: /booster\s*box/i,                  label: 'Booster Box' },
  { pattern: /gift\s*bundle/i,                  label: 'Gift Bundle' },
  { pattern: /bundle/i,                         label: 'Bundle' },
  { pattern: /commander\s*deck/i,               label: 'Commander Deck' },
  { pattern: /prerelease\s*pack/i,              label: 'Prerelease Pack' },
  { pattern: /starter\s*kit/i,                  label: 'Starter Kit' },
  { pattern: /jumpstart/i,                      label: 'Jumpstart Booster' },
  { pattern: /challenger\s*deck/i,              label: 'Challenger Deck' },
  { pattern: /booster\s*pack/i,                 label: 'Booster Pack' },
  { pattern: /\bbox\b/i,                        label: 'Box' },
];

/** Infer product type from text Tesseract actually read — pattern matches only. */
export function inferProductTypeFromText(text: string): string | null {
  const flat = text.replace(/\s+/g, ' ');

  for (const { pattern, label } of PRODUCT_TYPE_PATTERNS) {
    if (pattern.test(flat)) return label;
  }

  if (/\bcomm\w{0,6}\s*deck\b/i.test(flat)) return 'Commander Deck';
  if (/\bcmdr\s*deck\b/i.test(flat)) return 'Commander Deck';

  return null;
}

/** Resolved product type for an item — inferred from title. */
export function resolveItemProductType(item: ItemListing): string | null {
  return inferProductTypeFromText(getItemTitle(item));
}
