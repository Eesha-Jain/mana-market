'use client';

import type { PricingMode } from '@/types';
import { formatPrice } from '@/utils/productApi';

interface ListingPricingFieldsProps {
  marketPrice: number | null;
  pricingMode: PricingMode;
  percentBelow: number;
  manualPrice: number;
  finalPrice: number | null;
  onPricingModeChange: (mode: PricingMode) => void;
  onPercentBelowChange: (value: number) => void;
  onManualPriceChange: (value: number) => void;
  readOnly?: boolean;
  variant?: 'detail' | 'inline';
}

export function ListingPricingFields({
  marketPrice,
  pricingMode,
  percentBelow,
  manualPrice,
  finalPrice,
  onPricingModeChange,
  onPercentBelowChange,
  onManualPriceChange,
  readOnly = false,
  variant = 'detail',
}: ListingPricingFieldsProps) {
  if (readOnly) {
    return (
      <div className="detail-price-summary detail-price-summary--readonly">
        <div>
          <span className="text-muted-sm">Market price</span>
          <strong>{marketPrice != null ? formatPrice(marketPrice) : '—'}</strong>
        </div>
        <div>
          <span className="text-muted-sm">Your list price</span>
          <strong>{finalPrice !== null ? `$${finalPrice.toFixed(2)}` : '—'}</strong>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="pricing-controls">
        <select
          className="inline-select"
          value={pricingMode}
          onChange={e => onPricingModeChange(e.target.value as PricingMode)}
        >
          <option value="market">Market</option>
          <option value="percent_below">% below</option>
          <option value="manual">Manual</option>
        </select>
        {pricingMode === 'percent_below' && (
          <div className="percent-input-row">
            <input
              type="number"
              className="inline-input inline-input--sm"
              min={1}
              max={99}
              value={percentBelow}
              onChange={e =>
                onPercentBelowChange(Math.min(99, Math.max(1, parseInt(e.target.value, 10) || 0)))
              }
            />
            <span className="text-muted">%</span>
          </div>
        )}
        {pricingMode === 'manual' && (
          <div className="manual-input-row">
            <span className="text-muted">$</span>
            <input
              type="number"
              className="inline-input inline-input--sm"
              min={0.01}
              step={0.01}
              value={manualPrice || ''}
              placeholder="0.00"
              onChange={e => onManualPriceChange(parseFloat(e.target.value) || 0)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <label className="detail-field">
        <span>Pricing</span>
        <select
          className="detail-input"
          value={pricingMode}
          onChange={e => onPricingModeChange(e.target.value as PricingMode)}
        >
          <option value="market">
            Market price{marketPrice != null ? ` (${formatPrice(marketPrice)})` : ''}
          </option>
          <option value="percent_below">% below market</option>
          <option value="manual">Manual price</option>
        </select>
      </label>

      {pricingMode === 'percent_below' && (
        <label className="detail-field">
          <span>Discount %</span>
          <input
            type="number"
            className="detail-input"
            min={1}
            max={99}
            value={percentBelow}
            onChange={e =>
              onPercentBelowChange(Math.min(99, Math.max(1, parseInt(e.target.value, 10) || 0)))
            }
          />
        </label>
      )}

      {pricingMode === 'manual' && (
        <label className="detail-field">
          <span>Your price ($)</span>
          <input
            type="number"
            className="detail-input"
            min={0.01}
            step={0.01}
            value={manualPrice || ''}
            placeholder="0.00"
            onChange={e => onManualPriceChange(parseFloat(e.target.value) || 0)}
          />
        </label>
      )}

      <div className="detail-price-summary">
        <span>Final price:</span>
        <strong>{finalPrice !== null ? `$${finalPrice.toFixed(2)}` : '—'}</strong>
      </div>
    </>
  );
}
