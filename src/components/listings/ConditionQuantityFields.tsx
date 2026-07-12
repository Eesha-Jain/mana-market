'use client';

import type { EbayCondition } from '@/types';
import { EBAY_CONDITIONS } from '@/types';

type ConditionQuantityField = 'condition' | 'quantity';

interface ConditionQuantityFieldsProps {
  condition: EbayCondition | null;
  quantity: number;
  onConditionChange: (condition: EbayCondition | null) => void;
  onQuantityChange: (quantity: number) => void;
  readOnly?: boolean;
  layout?: 'row' | 'stack';
  variant?: 'detail' | 'inline';
  fields?: ConditionQuantityField[];
}

export function ConditionQuantityFields({
  condition,
  quantity,
  onConditionChange,
  onQuantityChange,
  readOnly = false,
  layout = 'row',
  variant = 'detail',
  fields = ['condition', 'quantity'],
}: ConditionQuantityFieldsProps) {
  const isInline = variant === 'inline';
  const wrapperClass = isInline
    ? undefined
    : layout === 'stack'
      ? 'condition-quantity-stack'
      : 'photo-review-field-row';

  const conditionControl = isInline ? (
    <select
      className={`inline-select${!condition ? ' inline-select--required' : ''}`}
      value={condition ?? ''}
      disabled={readOnly}
      onChange={e =>
        onConditionChange(
          e.target.value ? (e.target.value as EbayCondition) : null,
        )
      }
    >
      <option value="">Select…</option>
      {EBAY_CONDITIONS.map(c => (
        <option key={c.id} value={c.label} title={c.mtgEquivalent}>
          {c.label}
        </option>
      ))}
    </select>
  ) : (
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
  );

  const quantityControl = isInline ? (
    <input
      type="number"
      className="inline-input inline-input--sm"
      min={1}
      max={999}
      value={quantity}
      readOnly={readOnly}
      disabled={readOnly}
      onChange={e =>
        onQuantityChange(Math.max(1, parseInt(e.target.value, 10) || 1))
      }
    />
  ) : (
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
  );

  const content = (
    <>
      {fields.includes('condition') && conditionControl}
      {fields.includes('quantity') && quantityControl}
    </>
  );

  if (!wrapperClass) return content;

  return <div className={wrapperClass}>{content}</div>;
}
