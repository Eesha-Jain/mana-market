'use client';

import { useState } from 'react';
import type { ItemListing } from '../types';
import { CSV_COLUMNS, buildCsvContent, downloadCsv } from '../utils/csvExporter';

interface CsvExportModalProps {
  items: ItemListing[];
  onClose: () => void;
}

const DEFAULT_COLUMNS = [
  'listing_id', 'name', 'brand', 'upc', 'sku', 'condition', 'quantity', 'list_price', 'image_url', 'notes',
];

export function CsvExportModal({ items, onClose }: CsvExportModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_COLUMNS);
  const [headers, setHeaders] = useState<Record<string, string>>(() => {
    const h: Record<string, string> = {};
    for (const col of CSV_COLUMNS) h[col.id] = col.defaultHeader;
    return h;
  });

  const exportable = items.filter(i => i.status === 'found' && i.product);

  const toggleColumn = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const moveColumn = (id: string, dir: -1 | 1) => {
    setSelectedIds(prev => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap]!, next[idx]!];
      return next;
    });
  };

  const handleExport = () => {
    if (selectedIds.length === 0) return;
    const content = buildCsvContent(exportable, { columnIds: selectedIds, headers });
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(content, `mtg_inventory_${date}.csv`);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Export CSV</h2>
            <p className="modal-subtitle">
              Choose columns and rename headers for TCGPlayer or other marketplaces.
              {exportable.length} item{exportable.length !== 1 ? 's' : ''} will be exported.
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="csv-export-layout">
            <div className="csv-export-available">
              <h3 className="csv-export-heading">Available columns</h3>
              <div className="csv-export-checklist">
                {CSV_COLUMNS.map(col => (
                  <label key={col.id} className="csv-export-check">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(col.id)}
                      onChange={() => toggleColumn(col.id)}
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="csv-export-selected">
              <h3 className="csv-export-heading">Column order &amp; headers</h3>
              {selectedIds.length === 0 ? (
                <p className="text-muted">Select at least one column.</p>
              ) : (
                <div className="csv-export-header-list">
                  {selectedIds.map((id, idx) => {
                    const col = CSV_COLUMNS.find(c => c.id === id);
                    if (!col) return null;
                    return (
                      <div key={id} className="csv-export-header-row">
                        <div className="csv-export-order-btns">
                          <button
                            type="button"
                            className="btn-icon btn-sm"
                            disabled={idx === 0}
                            onClick={() => moveColumn(id, -1)}
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn-icon btn-sm"
                            disabled={idx === selectedIds.length - 1}
                            onClick={() => moveColumn(id, 1)}
                            title="Move down"
                          >
                            ↓
                          </button>
                        </div>
                        <span className="csv-export-col-label">{col.label}</span>
                        <input
                          type="text"
                          className="detail-input"
                          value={headers[id] ?? col.defaultHeader}
                          onChange={e =>
                            setHeaders(prev => ({ ...prev, [id]: e.target.value }))
                          }
                          placeholder={col.defaultHeader}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={selectedIds.length === 0 || exportable.length === 0}
            onClick={handleExport}
          >
            ↓ Download CSV ({exportable.length} items)
          </button>
        </div>
      </div>
    </div>
  );
}
