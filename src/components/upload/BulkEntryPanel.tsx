'use client';

interface BulkEntryPanelProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  lineCount: number;
  disabled?: boolean;
}

export function BulkEntryPanel({ value, onChange, onSubmit, lineCount, disabled }: BulkEntryPanelProps) {
  return (
    <div className="tab-content">
      <p className="tab-hint">
        Paste one entry per line — product name, SKU, UPC, or name + identifier (comma- or tab-separated).
        UPC is looked up first when present. Name and SKU both help find items;
        when one returns multiple matches, the other narrows the list.
      </p>
      <textarea
        className="bulk-textarea"
        placeholder={'Modern Horizons 3 Booster Box\n630509777771\nModern Horizons 3 Booster Box, 630509777771'}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={8}
        disabled={disabled}
      />
      <div className="tab-actions">
        <button className="btn-primary" onClick={onSubmit} disabled={!value.trim() || disabled}>
          Review {lineCount || 0} item{lineCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}
