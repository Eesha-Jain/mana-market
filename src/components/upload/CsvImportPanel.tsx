'use client';

import type { ChangeEvent, DragEvent, RefObject } from 'react';
import {
  getDuplicateMappingWarnings,
  type RawParsedTable,
  type ColumnMappingChoice,
} from '@/utils/csv';
import { CsvColumnMapper } from './CsvColumnMapper';

export interface CsvPreviewRow {
  query: string;
  displayName: string;
  upc: string;
  sku: string;
  quantity: string;
  condition: string;
  notes: string;
  price: string;
}

interface CsvImportPanelProps {
  pendingImport: RawParsedTable | null;
  columnMappings: Record<string, ColumnMappingChoice>;
  csvPreview: CsvPreviewRow[];
  hasBarcodes: boolean;
  pasteText: string;
  isDragging: boolean;
  entryReviewActive: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onMappingChange: (header: string, choice: ColumnMappingChoice) => void;
  onConfirmMappings: () => void;
  onCancelMappings: () => void;
  onClearPreview: () => void;
  onReviewCsv: () => void;
  onPasteTextChange: (value: string) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onFileInput: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function CsvImportPanel({
  pendingImport,
  columnMappings,
  csvPreview,
  hasBarcodes,
  pasteText,
  isDragging,
  entryReviewActive,
  fileInputRef,
  onMappingChange,
  onConfirmMappings,
  onCancelMappings,
  onClearPreview,
  onReviewCsv,
  onPasteTextChange,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileInput,
}: CsvImportPanelProps) {
  return (
    <div className="tab-content">
      <div className="csv-info">
        <div>
          <p className="tab-hint" style={{ marginBottom: 4 }}>
            Upload a file <strong>or paste directly from Google Sheets</strong>.
            Each row opens a review dialog before joining the queue.
          </p>
          <p className="tab-hint" style={{ marginBottom: 0 }}>
            Recognized columns: <code>Name</code>, <code>SKU</code>, <code>UPC</code>, <code>Set</code>,
            <code> Collector #</code>, <code>Quantity</code>, <code>Condition</code>, <code>Notes</code>,
            <code> Price</code>. Unrecognized columns can be mapped or discarded before import.
          </p>
        </div>
        <a
          href={
            'data:text/csv;charset=utf-8,' +
            encodeURIComponent('Name\tSKU\tQuantity\tCondition\tNotes\n') +
            encodeURIComponent('Modern Horizons 3 Booster Box\t\t1\tNew\t\n') +
            encodeURIComponent('Commander Masters Bundle\t630509777771\t1\tLike New\t\n')
          }
          download="mtg_lister_template.tsv"
          className="btn-ghost btn-sm"
          style={{ whiteSpace: 'nowrap' }}
        >
          ↓ Template
        </a>
      </div>

      {pendingImport ? (
        <CsvColumnMapper
          unrecognizedHeaders={pendingImport.unrecognizedHeaders}
          mappings={columnMappings}
          mappingWarnings={getDuplicateMappingWarnings(pendingImport, columnMappings)}
          onMappingChange={onMappingChange}
          onConfirm={onConfirmMappings}
          onCancel={onCancelMappings}
          rowCount={pendingImport.rawRows.length}
        />
      ) : csvPreview.length > 0 ? (
        <div className="csv-preview">
          <div className="csv-preview-header">
            <span className="csv-preview-count">{csvPreview.length} rows ready to review</span>
            <button className="btn-ghost btn-sm" onClick={onClearPreview} disabled={entryReviewActive}>
              Clear
            </button>
          </div>

          {hasBarcodes && (
            <div className="barcode-notice">
              <span>ℹ️</span>
              <span>
                UPC is looked up first when present. Name and SKU both help find items on eBay;
                when one returns multiple matches, the other narrows the list.
              </span>
            </div>
          )}

          <div className="items-table-wrapper">
            <table className="items-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>UPC</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Condition</th>
                </tr>
              </thead>
              <tbody>
                {csvPreview.slice(0, 12).map((row, i) => (
                  <tr key={i}>
                    <td className="text-muted">{i + 1}</td>
                    <td><span style={{ fontWeight: 500 }}>{row.displayName}</span></td>
                    <td className="text-muted">{row.upc || '—'}</td>
                    <td className="text-muted">{row.sku || '—'}</td>
                    <td>{row.quantity || '1'}</td>
                    <td>{row.condition || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {csvPreview.length > 12 && (
              <p className="csv-preview-more">…and {csvPreview.length - 12} more rows</p>
            )}
          </div>
          <div className="tab-actions">
            <button className="btn-primary" onClick={onReviewCsv} disabled={entryReviewActive}>
              Review {csvPreview.length} item{csvPreview.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      ) : (
        <div className="csv-input-area">
          <div
            className={`dropzone${isDragging ? ' dropzone--active' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="dropzone-icon">📂</span>
            <span className="dropzone-text">Drop your CSV / TSV here, or click to browse</span>
            <span className="dropzone-hint">.csv  .tsv  .txt</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="sr-only"
              onChange={onFileInput}
            />
          </div>

          <div className="paste-divider">
            <span>— or paste from Google Sheets / Excel below —</span>
          </div>

          <textarea
            className="bulk-textarea"
            placeholder={
              'Name\tSKU\tquantity\n' +
              'Modern Horizons 3 Booster Box\t630509777771\t1\n' +
              'Commander Masters Bundle\t\t2'
            }
            value={pasteText}
            onChange={e => onPasteTextChange(e.target.value)}
            rows={8}
            spellCheck={false}
          />
          <p className="tab-hint" style={{ marginTop: 6 }}>
            Paste your spreadsheet data above — the first row must be a header row.
          </p>
        </div>
      )}
    </div>
  );
}
