import type { ItemListing, ItemStatus } from '../types';

export interface ItemStatusCounts {
  pending: number;
  found: number;
  ambiguous: number;
  notFound: number;
}

export function countItemStatuses(items: ItemListing[]): ItemStatusCounts {
  return {
    pending: items.filter(i => i.status === 'idle' || i.status === 'searching').length,
    found: items.filter(i => i.status === 'found').length,
    ambiguous: items.filter(i => i.status === 'ambiguous').length,
    notFound: items.filter(i => i.status === 'not_found').length,
  };
}

export function getItemStatusLabel(status: ItemStatus): string {
  switch (status) {
    case 'found':
      return 'Ready to customize';
    case 'ambiguous':
      return 'Multiple matches — select a product';
    case 'not_found':
      return 'Not found online';
    case 'idle':
    case 'searching':
      return 'Searching…';
    default:
      return status;
  }
}
