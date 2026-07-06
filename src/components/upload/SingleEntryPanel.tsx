'use client';

interface SingleEntryPanelProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function SingleEntryPanel({ value, onChange, onSubmit, disabled }: SingleEntryPanelProps) {
  return (
    <div className="tab-content">
      <p className="tab-hint">
        Enter a product name, SKU, or UPC. You can combine name and identifier with a comma
        (e.g. <code>Modern Horizons 3 Booster Box, 630509777771</code> or <code>MH3 Box, WOC-12345</code>).
      </p>
      <div className="single-input-row">
        <input
          type="text"
          className="single-input"
          placeholder="e.g. Modern Horizons Booster Box, 630509777771"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          autoFocus
          disabled={disabled}
        />
        <button className="btn-primary" onClick={onSubmit} disabled={!value.trim() || disabled}>
          Review
        </button>
      </div>
    </div>
  );
}
