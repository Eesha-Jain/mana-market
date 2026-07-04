'use client';

import type { EbayCondition } from '../types';
import { EBAY_CONDITIONS } from '../types';

interface ConditionQuantityFieldsProps {
  condition: EbayCondition | null;
  quantity: number;
  onConditionChange: (condition: EbayCondition | null) => void;
  onQuantityChange: (quantity: number) => void;
  /** Show MTG equivalent in condition dropdown (e.g. "Like New (Near Mint)"). */
  showMtgEquivalent?: boolean;
  layout?: 'row' | 'stack';
}

export function ConditionQuantityFields({
  condition,
  quantity,
  onConditionChange,
  onQuantityChange,
  showMtgEquivalent = true,
  layout = 'row',
}: ConditionQuantityFieldsProps) {
  const wrapperClass =
    layout === 'row' ? 'photo-review-field-row' : 'condition-quantity-stack';

  return (
    <div className={wrapperClass}>
      <label className="detail-field">
        <span>Condition <span className="required-mark">*</span></span>
        <select
          className="detail-input"
          value={condition ?? ''}
          onChange={e =>
            onConditionChange(e.target.value ? (e.target.value as EbayCondition) : null)
          }
        >
          <option value="">— Select condition —</option>
          {EBAY_CONDITIONS.map(c => (
            <option key={c.id} value={c.label} title={c.mtgEquivalent}>
              {showMtgEquivalent ? `${c.label} (${c.mtgEquivalent})` : c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="detail-field">
        <span>Quantity</span>
        <input
          type="number"
          className="detail-input"
          min={1}
          max={999}
          value={quantity}
          onChange={e =>
            onQuantityChange(Math.max(1, parseInt(e.target.value, 10) || 1))
          }
        />
      </label>
    </div>
  );
}
