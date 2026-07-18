'use client';

import type { ReactNode } from 'react';
import type { MarketPricePreference, MarketPriceOption, Product } from '@/types';
import { formatPrice } from '@/utils/productApi';
import {
  formatOfferUpdatedAt,
  getMarketPriceOptionId,
  getMarketPriceOptions,
  getMarketPriceSourceUrl,
  optionDisplayLabel,
  resolveProductMarketSelection,
} from '@/utils/marketPrice';

interface MarketPriceSourceFieldsProps {
  product: Product | null | undefined;
  preference: MarketPricePreference;
  selectedSource?: string | null;
  onPreferenceChange: (preference: MarketPricePreference) => void;
  onSelectedSourceChange: (source: string) => void;
  compact?: boolean;
  readOnly?: boolean;
}

function formatOptionSelectLabel(option: MarketPriceOption): string {
  const updated = formatOfferUpdatedAt(option.updatedAt);
  const base = `${optionDisplayLabel(option)} — ${formatPrice(option.price)}`;
  return updated ? `${base} · ${updated}` : base;
}

function SourceLabelLink({
  product,
  optionId,
  children,
}: {
  product: Product | null | undefined;
  optionId: string | null | undefined;
  children: ReactNode;
}) {
  const url = getMarketPriceSourceUrl(product, optionId);
  if (!url || !optionId) return <>{children}</>;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="market-price-source-link"
      title="Open price source"
      onClick={e => e.stopPropagation()}
    >
      {children}
    </a>
  );
}

export function MarketPriceSourceFields({
  product,
  preference,
  selectedSource,
  onPreferenceChange,
  onSelectedSourceChange,
  compact = false,
  readOnly = false,
}: MarketPriceSourceFieldsProps) {
  const active = resolveProductMarketSelection(product, preference, selectedSource);
  const options = getMarketPriceOptions(product);

  if (readOnly) {
    if (!active.source && active.price == null) return null;
    const activeOption = options.find(o => getMarketPriceOptionId(o) === active.optionId);
    return (
      <p className="market-price-source-active text-muted-sm">
        Market from{' '}
        <SourceLabelLink product={product} optionId={active.optionId}>
          {activeOption ? optionDisplayLabel(activeOption) : 'lookup'}
        </SourceLabelLink>
        {active.price != null ? ` · ${formatPrice(active.price)}` : ''}
      </p>
    );
  }

  if (!options.length) return null;

  const activeOption = options.find(o => getMarketPriceOptionId(o) === active.optionId);
  const selectValue = active.optionId ?? getMarketPriceOptionId(options[0]!);

  return (
    <div className={`market-price-source-fields${compact ? ' market-price-source-fields--compact' : ''}`}>
      <label className="detail-field">
        <span>Market price from</span>
        <select
          className="detail-input market-price-source-select"
          value={selectValue}
          onChange={e => {
            onSelectedSourceChange(e.target.value);
            // Honor the explicit pick even if settings default is amazon/upc-only.
            if (preference !== 'show_all') onPreferenceChange('show_all');
          }}
        >
          {options.map(option => {
            const optionId = getMarketPriceOptionId(option);
            return (
              <option key={optionId} value={optionId}>
                {formatOptionSelectLabel(option)}
              </option>
            );
          })}
        </select>
      </label>

      {active.source && (
        <p className="market-price-source-active text-muted-sm">
          Using{' '}
          <SourceLabelLink product={product} optionId={active.optionId}>
            {activeOption ? optionDisplayLabel(activeOption) : 'lookup'}
          </SourceLabelLink>
          {active.price != null ? ` · ${formatPrice(active.price)}` : ''}
        </p>
      )}
    </div>
  );
}
