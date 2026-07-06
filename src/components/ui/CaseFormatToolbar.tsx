'use client';

import type { ReactNode } from 'react';
import { applyTextCase, TEXT_CASE_TOOLBAR, type TextCaseFormat } from '@/utils/textCase';

interface CaseFormatToolbarProps {
  value: string;
  onChange: (next: string) => void;
  /** Called after a format button is applied (e.g. to mark field as manually edited). */
  onFormatted?: () => void;
  /** Called with the format that was applied — useful for "save as default" prompts. */
  onFormatSelect?: (format: Exclude<TextCaseFormat, 'as_detected'>) => void;
}

export function CaseFormatToolbar({ value, onChange, onFormatted, onFormatSelect }: CaseFormatToolbarProps) {
  const apply = (format: Exclude<TextCaseFormat, 'as_detected'>) => {
    onChange(applyTextCase(value, format));
    onFormatSelect?.(format);
    onFormatted?.();
  };

  return (
    <div className="case-format-toolbar" role="toolbar" aria-label="Text capitalization">
      {TEXT_CASE_TOOLBAR.map(opt => (
        <button
          key={opt.value}
          type="button"
          className="case-format-btn"
          title={opt.title}
          aria-label={opt.title}
          onClick={() => apply(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface LabeledFieldWithCaseProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onFormatted?: () => void;
  onFormatSelect?: (format: Exclude<TextCaseFormat, 'as_detected'>) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  required?: boolean;
  hint?: ReactNode;
  readOnly?: boolean;
}

export function LabeledFieldWithCase({
  label,
  value,
  onChange,
  onFormatted,
  onFormatSelect,
  multiline = false,
  rows = 4,
  placeholder,
  required,
  hint,
  readOnly = false,
}: LabeledFieldWithCaseProps) {
  return (
    <label className="detail-field">
      <div className="detail-field-header">
        <span>
          {label}
          {required && <span className="required-mark"> *</span>}
        </span>
        {!readOnly && (
          <CaseFormatToolbar
            value={value}
            onChange={onChange}
            onFormatted={onFormatted}
            onFormatSelect={onFormatSelect}
          />
        )}
      </div>
      {multiline ? (
        <textarea
          className="detail-input detail-textarea"
          rows={rows}
          placeholder={placeholder}
          value={value}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          className="detail-input"
          placeholder={placeholder}
          value={value}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={e => onChange(e.target.value)}
        />
      )}
      {hint}
    </label>
  );
}
