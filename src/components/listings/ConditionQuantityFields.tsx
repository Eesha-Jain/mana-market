'use client';

import type { EbayCondition } from '@/types';
import { EBAY_CONDITIONS } from '@/types';

interface ConditionQuantityFieldsProps {
  condition: EbayCondition | null;
  quantity: number;
  onConditionChange: (condition: EbayCondition | null) => void;
  onQuantityChange: (quantity: number) => void;
  readOnly?: boolean;
  layout?: 'row' | 'stack';
}

export function ConditionQuantityFields({
  condition,
  quantity,
  onConditionChange,
  onQuantityChange,
  readOnly = false,
  layout = 'row',
}: ConditionQuantityFieldsProps) {
  const wrapperClass = layout === 'stack' ? 'condition-quantity-stack' : 'photo-review-field-row';

  return (
    <div className={wrapperClass}>
      <label className="detail-field">
        <span>Condition <span className="required-mark">*</span></span>
        <select
          className="detail-input"
          value={condition ?? ''}
          disabled={readOnly}
          onChange={e =>
            onConditionChange(
              e.target.value ? (e.target.value as EbayCondition) : null,
            )
          }
        >
          <option value="">— Select condition —</option>
          {EBAY_CONDITIONS.map(c => (
            <option key={c.id} value={c.label} title={c.mtgEquivalent}>
              {`${c.label} (${c.mtgEquivalent})`}
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
          readOnly={readOnly}
          disabled={readOnly}
          onChange={e =>
            onQuantityChange(Math.max(1, parseInt(e.target.value, 10) || 1))
          }
        />
      </label>
    </div>
  );
}
