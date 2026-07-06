'use client';

interface ManualEntryPanelProps {
  mode: 'single' | 'bulk';
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  lineCount?: number;
  disabled?: boolean;
}

export function ManualEntryPanel({
  mode,
  value,
  onChange,
  onSubmit,
  lineCount = 0,
  disabled,
}: ManualEntryPanelProps) {
  const canSubmit = !!value.trim() && !disabled;

  return (
    <div className="tab-content">
      <p className="tab-hint">
        {mode === 'bulk' ? (
          <>
            Paste one entry per line — product name, SKU, UPC, or name + identifier (comma- or tab-separated).
            UPC is looked up first when present. Name and SKU both help find items;
            when one returns multiple matches, the other narrows the list.
          </>
        ) : (
          <>
            Enter a product name, SKU, or UPC. You can combine name and identifier with a comma
            (e.g. <code>Modern Horizons 3 Booster Box, 630509777771</code> or <code>MH3 Box, WOC-12345</code>).
          </>
        )}
      </p>
      {mode === 'bulk' ? (
        <>
          <textarea
            className="bulk-textarea"
            placeholder={'Modern Horizons 3 Booster Box\n630509777771\nModern Horizons 3 Booster Box, 630509777771'}
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={8}
            disabled={disabled}
          />
          <div className="tab-actions">
            <button className="btn-primary" onClick={onSubmit} disabled={!canSubmit}>
              Review {lineCount || 0} item{lineCount !== 1 ? 's' : ''}
            </button>
          </div>
        </>
      ) : (
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
          <button className="btn-primary" onClick={onSubmit} disabled={!canSubmit}>
            Review
          </button>
        </div>
      )}
    </div>
  );
}
