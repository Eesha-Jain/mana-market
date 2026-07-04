'use client';

import type { MarketPricePreference, MarketPriceSource, Product } from '../types';
import { formatPrice, getMarketPriceSourceLabel } from '../utils/productApi';
import {
  getMarketPriceOptions,
  resolveProductMarketSelection,
  shouldShowMarketPricePicker,
} from '../utils/marketPrice';
import { MARKET_PRICE_PREFERENCE_OPTIONS } from '../utils/userSettings';

interface MarketPriceSourceFieldsProps {
  product: Product | null | undefined;
  preference: MarketPricePreference;
  selectedSource?: MarketPriceSource | null;
  onPreferenceChange: (preference: MarketPricePreference) => void;
  onSelectedSourceChange: (source: MarketPriceSource) => void;
  compact?: boolean;
}

export function MarketPriceSourceFields({
  product,
  preference,
  selectedSource,
  onPreferenceChange,
  onSelectedSourceChange,
  compact = false,
}: MarketPriceSourceFieldsProps) {
  const options = getMarketPriceOptions(product);
  if (!options.length) return null;

  const active = resolveProductMarketSelection(product, preference, selectedSource);
  const showPicker = shouldShowMarketPricePicker(product, preference);

  return (
    <div className={`market-price-source-fields${compact ? ' market-price-source-fields--compact' : ''}`}>
      <label className="detail-field">
        <span>Market price from</span>
        <select
          className="detail-input"
          value={preference}
          onChange={e => onPreferenceChange(e.target.value as MarketPricePreference)}
        >
          {MARKET_PRICE_PREFERENCE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {!showPicker && active.source && (
        <p className="market-price-source-active text-muted text-sm">
          Using {getMarketPriceSourceLabel(active.source, 'short')}
          {active.price != null ? ` · ${formatPrice(active.price)}` : ''}
        </p>
      )}

      {showPicker && (
        <fieldset className="market-price-option-list">
          <legend className="market-price-option-legend">Choose price for this listing</legend>
          {options.map(option => {
            const checked = (selectedSource ?? options[0]?.source) === option.source;
            return (
              <label key={option.source} className="market-price-option">
                <input
                  type="radio"
                  name="market-price-source"
                  checked={checked}
                  onChange={() => onSelectedSourceChange(option.source)}
                />
                <span className="market-price-option-copy">
                  <strong>{getMarketPriceSourceLabel(option.source, 'short')}</strong>
                  <span>{formatPrice(option.price)}</span>
                  {option.soldCount != null && option.source === 'ebay_completed' && (
                    <span className="text-muted text-sm">{option.soldCount} sold</span>
                  )}
                  {option.priceRange && (
                    <span className="text-muted text-sm">
                      ${option.priceRange.low.toFixed(2)}–${option.priceRange.high.toFixed(2)}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}
