'use client';

export type InventoryViewMode = 'table' | 'cards';

interface InventoryViewToggleProps {
  value: InventoryViewMode;
  onChange: (mode: InventoryViewMode) => void;
}

export function InventoryViewToggle({ value, onChange }: InventoryViewToggleProps) {
  return (
    <div className="view-toggle" role="group" aria-label="View mode">
      <button
        type="button"
        className={`view-toggle-btn${value === 'cards' ? ' active' : ''}`}
        onClick={() => onChange('cards')}
      >
        Cards
      </button>
      <button
        type="button"
        className={`view-toggle-btn${value === 'table' ? ' active' : ''}`}
        onClick={() => onChange('table')}
      >
        Table
      </button>
    </div>
  );
}
