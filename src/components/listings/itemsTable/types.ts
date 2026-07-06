import type { CSSProperties, ReactNode } from 'react';
import type { ItemListing } from '@/types';

export type ItemsTableVariant = 'standard' | 'review' | 'exported';

export interface ItemTableContext {
  onRowClick?: (item: ItemListing) => void;
  onRemove?: (itemId: string) => void;
  onUpdate?: (itemId: string, updates: Partial<ItemListing>) => void;
  onResolveAmbiguous?: (item: ItemListing) => void;
  showRemove: boolean;
}

export interface ItemTableColumnDef {
  id: string;
  header: ReactNode;
  headerWidth?: number | string;
  headerStyle?: CSSProperties;
  className?: string;
  stopPropagation?: boolean;
  render: (item: ItemListing, ctx: ItemTableContext) => ReactNode;
}

export interface CustomRowRenderProps {
  item: ItemListing;
  ctx: ItemTableContext;
  columns: ItemTableColumnDef[];
  /** Data columns plus optional remove column */
  totalColumnCount: number;
}

export interface CustomRowDef {
  match: (item: ItemListing) => boolean;
  render: (props: CustomRowRenderProps) => ReactNode;
}

export interface ItemTableVariantConfig {
  columns: ItemTableColumnDef[];
  customRows?: CustomRowDef[];
  rowClassName?: (item: ItemListing, ctx: ItemTableContext) => string | undefined;
  isRowClickable?: (item: ItemListing, ctx: ItemTableContext) => boolean;
  onRowClick?: (item: ItemListing, ctx: ItemTableContext) => void;
}
