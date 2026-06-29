import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useItems } from '../contexts/ItemsContext';
import {
  parseTableRaw,
  applyColumnMappings,
  parseCSVFileRaw,
  defaultColumnMappings,
  type RawParsedTable,
  type ColumnMappingChoice,
} from '../utils/csvParser';
import { getLookupFromRow, parseBulkLine } from '../utils/productLookup';
import type { CSVRow, EbayCondition } from '../types';
import { PhotoScanTab } from '../components/PhotoScanTab';
import { ProductReviewFlow } from '../components/ProductReviewFlow';
import { CsvColumnMapper } from '../components/CsvColumnMapper';
import { buildEntryDraft, type EntryReviewDraft } from '../utils/entryReview';
import {
  buildEntryProductReviewData,
  type ProductReviewConfirmPayload,
  type ProductReviewData,
} from '../utils/productReview';
import { getItemTitle } from '../types';
import { countItemStatuses } from '../utils/itemStatus';
import { QueueStatusDot } from '../components/QueueStatusDot';

interface PreviewRow {
  query: string;
  displayName: string;
  upc: string;
  sku: string;
  quantity: string;
  condition: string;
  notes: string;
  price: string;
}

function buildPreview(rows: CSVRow[]): PreviewRow[] {
  return rows
    .map(r => {
      const { query, originalUpc, originalSku } = getLookupFromRow(r);
      const name = (r.name || '').trim();
      return {
        query,
        displayName: name || query,
        upc: originalUpc || (r.upc || '').trim(),
        sku: originalSku || '',
        quantity:  r.quantity  || '',
        condition: r.condition || '',
        notes:     r.notes     || '',
        price:     r.price     || '',
      };
    })
    .filter(r => r.query.length > 0);
}

function previewRowToDraft(row: PreviewRow): EntryReviewDraft {
  return buildEntryDraft({
    query: row.query,
    source: 'csv',
    originalUpc: row.upc || undefined,
    originalSku: row.sku || undefined,
    quantity: row.quantity ? parseInt(row.quantity, 10) || 1 : 1,
    condition: row.condition || undefined,
    notes: row.notes || undefined,
    price: row.price || undefined,
  });
}

export function UploadPage() {
  const { items, addItem } = useItems();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'csv' | 'photo'>('single');
  const [manualInput, setManualInput] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [csvError, setCsvError] = useState('');
  const [csvPreview, setCsvPreview] = useState<PreviewRow[]>([]);
  const [csvConfirmed, setCsvConfirmed] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [hasBarcodes, setHasBarcodes] = useState(false);
  const [pendingImport, setPendingImport] = useState<RawParsedTable | null>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, ColumnMappingChoice>>({});
  const [importSourceLabel, setImportSourceLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [entryQueue, setEntryQueue] = useState<EntryReviewDraft[]>([]);
  const [entryIndex, setEntryIndex] = useState(0);
  const [entryReviewActive, setEntryReviewActive] = useState(false);
  const [entryReviewData, setEntryReviewData] = useState<ProductReviewData | null>(null);
  const [entryLookupLoading, setEntryLookupLoading] = useState(false);

  const entryQueueRef = useRef(entryQueue);
  const entryIndexRef = useRef(entryIndex);
  const entryReviewActiveRef = useRef(entryReviewActive);
  const batchConditionPrefillRef = useRef<EbayCondition | null>(null);
  entryQueueRef.current = entryQueue;
  entryIndexRef.current = entryIndex;
  entryReviewActiveRef.current = entryReviewActive;

  const { pending, ambiguous, found, notFound } = countItemStatuses(items);

  const finishEntryQueue = () => {
    batchConditionPrefillRef.current = null;
    setEntryQueue([]);
    setEntryIndex(0);
    setEntryReviewActive(false);
    setEntryReviewData(null);
    setEntryLookupLoading(false);
  };

  const processEntryDraftAt = async (index: number, drafts = entryQueueRef.current) => {
    const draft = drafts[index];
    if (!draft) {
      finishEntryQueue();
      return;
    }

    setEntryLookupLoading(true);
    setEntryReviewData(null);
    try {
      const data = await buildEntryProductReviewData(draft);
      const prefill = batchConditionPrefillRef.current;
      if (!draft.condition && prefill) {
        data.initialCondition = prefill;
      }
      setEntryReviewData(data);
    } finally {
      setEntryLookupLoading(false);
    }
  };

  const startEntryReview = (drafts: EntryReviewDraft[]) => {
    if (!drafts.length || entryReviewActiveRef.current) return;
    batchConditionPrefillRef.current = null;
    setEntryQueue(drafts);
    setEntryIndex(0);
    setEntryReviewActive(true);
    void processEntryDraftAt(0, drafts);
  };

  const advanceEntryQueue = () => {
    const nextIndex = entryIndexRef.current + 1;
    if (nextIndex >= entryQueueRef.current.length) {
      finishEntryQueue();
      return;
    }
    setEntryIndex(nextIndex);
    void processEntryDraftAt(nextIndex);
  };

  const queueEntry = (payload: ProductReviewConfirmPayload) => {
    addItem(payload.query, payload.source, {
      customTitle: payload.customTitle,
      customDescription: payload.customDescription,
      originalUpc: payload.originalUpc,
      originalSku: payload.originalSku,
      quantity: payload.quantity,
      condition: payload.condition,
      pricingMode: payload.pricingMode,
      percentBelow: payload.percentBelow,
      manualPrice: payload.manualPrice,
      marketPricePreference: payload.marketPricePreference,
      selectedMarketPriceSource: payload.selectedMarketPriceSource,
      notes: payload.notes,
      photoUrl: payload.photoUrl,
      userImageUrl: payload.userImageUrl,
      preferredImageSource: payload.preferredImageSource,
      status: payload.product ? 'found' : 'not_found',
      product: payload.product,
      detectedProductType: payload.parseMeta?.packType,
      detectedCardCount: payload.parseMeta?.cardCount,
    });
  };

  const handleApplyConditionToRemaining = (condition: EbayCondition) => {
    batchConditionPrefillRef.current = condition;
    const currentIndex = entryIndexRef.current;
    setEntryQueue(prev =>
      prev.map((draft, index) =>
        index > currentIndex && !draft.condition ? { ...draft, condition } : draft,
      ),
    );
  };

  const handleConfirmEntry = (payload: ProductReviewConfirmPayload) => {
    queueEntry(payload);
    setEntryReviewData(null);
    advanceEntryQueue();
  };

  const handleSkipEntry = () => {
    setEntryReviewData(null);
    advanceEntryQueue();
  };

  const handleExitEntryToReview = () => {
    finishEntryQueue();
    navigate('/review');
  };

  const handleCancelEntryBatch = () => {
    finishEntryQueue();
  };

  const handleReviewSingle = () => {
    const query = manualInput.trim();
    if (!query) return;
    startEntryReview([buildEntryDraft({ query, source: 'manual' })]);
    setManualInput('');
  };

  const handleReviewBulk = () => {
    const lines = bulkText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    startEntryReview(
      lines.map(line => {
        const { query, originalUpc, originalSku } = parseBulkLine(line);
        return buildEntryDraft({ query, originalUpc, originalSku, source: 'manual' });
      }),
    );
    setBulkText('');
  };

  const applyRows = (rows: CSVRow[], source: string) => {
    setCsvError('');
    setCsvConfirmed(false);
    setPendingImport(null);
    setColumnMappings({});
    setImportSourceLabel('');
    const preview = buildPreview(rows);
    if (!preview.length) {
      setCsvError(
        `No valid rows found in ${source}. ` +
        'Make sure there is a header row with at least a "Name" or "SKU" column.'
      );
      return;
    }
    setHasBarcodes(preview.some(r => r.upc || r.sku));
    setCsvPreview(preview);
  };

  const handleParsedTable = (parsed: RawParsedTable | null, source: string) => {
    setCsvError('');
    setCsvConfirmed(false);
    setCsvPreview([]);

    if (!parsed || !parsed.rawRows.length) {
      setPendingImport(null);
      setColumnMappings({});
      setImportSourceLabel('');
      setCsvError(
        `No valid rows found in ${source}. ` +
        'Make sure there is a header row with at least a "Name" or "SKU" column.'
      );
      return;
    }

    if (parsed.unrecognizedHeaders.length > 0) {
      setPendingImport(parsed);
      setColumnMappings(defaultColumnMappings(parsed.unrecognizedHeaders));
      setImportSourceLabel(source);
      return;
    }

    applyRows(applyColumnMappings(parsed, {}), source);
  };

  const handleConfirmColumnMappings = () => {
    if (!pendingImport) return;
    applyRows(applyColumnMappings(pendingImport, columnMappings), importSourceLabel || 'import');
  };

  const handleCancelColumnMappings = () => {
    setPendingImport(null);
    setColumnMappings({});
    setImportSourceLabel('');
    setCsvError('');
  };

  const handleColumnMappingChange = (header: string, choice: ColumnMappingChoice) => {
    setColumnMappings(prev => ({ ...prev, [header]: choice }));
  };

  const processFile = async (file: File) => {
    if (!file.name.match(/\.(csv|txt|tsv)$/i)) {
      setCsvError('Please upload a .csv, .tsv, or .txt file.');
      return;
    }
    try {
      handleParsedTable(await parseCSVFileRaw(file), `"${file.name}"`);
    } catch {
      setCsvError('Failed to parse the file. Is it a valid CSV/TSV?');
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handlePasteTextChange = (value: string) => {
    setPasteText(value);
    if (!value.trim()) {
      setCsvPreview([]);
      setCsvError('');
      setPendingImport(null);
      setColumnMappings({});
      return;
    }
    const lines = value.split(/\r?\n/).filter(l => l.trim());
    if (lines.length >= 2) {
      handleParsedTable(parseTableRaw(value), 'pasted text');
    }
  };

  const handleReviewCSV = () => {
    if (!csvPreview.length) return;
    startEntryReview(csvPreview.map(previewRowToDraft));
    setCsvPreview([]);
    setPasteText('');
    setCsvConfirmed(true);
  };

  const clearPreview = () => {
    setCsvPreview([]);
    setPasteText('');
    setCsvError('');
    setPendingImport(null);
    setColumnMappings({});
    setImportSourceLabel('');
  };

  const switchTab = (tab: typeof activeTab) => {
    if (entryReviewActive) return;
    setActiveTab(tab);
  };

  const currentDraft = entryReviewActive ? entryQueue[entryIndex] : null;
  const entryProgress = entryReviewActive && entryQueue.length > 1
    ? {
        current: entryIndex + 1,
        total: entryQueue.length,
        remaining: entryQueue.length - entryIndex - 1,
      }
    : undefined;

  const bulkLineCount = bulkText.trim().split(/\r?\n/).filter(Boolean).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload Items</h1>
          <p className="page-subtitle">
            Add Magic: The Gathering products by name, SKU, UPC, or paste from a spreadsheet.
            UPC is looked up first when provided. Product name and SKU both help find items on eBay;
            when one returns multiple matches, the other is used to narrow results.
          </p>
        </div>
        {items.length > 0 && (
          <button className="btn-primary" onClick={() => navigate('/review')}>
            Review {items.length} item{items.length !== 1 ? 's' : ''} →
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div className="progress-section">
          <div className="progress-stats">
            {pending   > 0 && <span className="badge badge--blue badge--pulse">{pending} searching</span>}
            {found     > 0 && <span className="badge badge--green">{found} found</span>}
            {ambiguous > 0 && <span className="badge badge--yellow">{ambiguous} needs selection</span>}
            {notFound  > 0 && <span className="badge badge--red">{notFound} not found</span>}
          </div>
          {pending > 0 && (
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${((found + ambiguous + notFound) / items.length) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="upload-card">
        <div className="tab-bar">
          <button className={`tab-btn${activeTab === 'single' ? ' active' : ''}`} onClick={() => switchTab('single')} disabled={entryReviewActive}>
            Single Entry
          </button>
          <button className={`tab-btn${activeTab === 'bulk' ? ' active' : ''}`} onClick={() => switchTab('bulk')} disabled={entryReviewActive}>
            Bulk Names
          </button>
          <button className={`tab-btn${activeTab === 'csv' ? ' active' : ''}`} onClick={() => switchTab('csv')} disabled={entryReviewActive}>
            CSV / Spreadsheet
          </button>
          <button className={`tab-btn${activeTab === 'photo' ? ' active' : ''}`} onClick={() => switchTab('photo')} disabled={entryReviewActive}>
            Photo Scan
          </button>
        </div>

        {activeTab === 'single' && (
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
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReviewSingle()}
                autoFocus
                disabled={entryReviewActive}
              />
              <button className="btn-primary" onClick={handleReviewSingle} disabled={!manualInput.trim() || entryReviewActive}>
                Review
              </button>
            </div>
          </div>
        )}

        {activeTab === 'bulk' && (
          <div className="tab-content">
            <p className="tab-hint">
              Paste one entry per line — product name, SKU, UPC, or name + identifier (comma- or tab-separated).
              UPC is looked up first when present. Name and SKU both help find items;
              when one returns multiple matches, the other narrows the list.
            </p>
            <textarea
              className="bulk-textarea"
              placeholder={'Modern Horizons 3 Booster Box\n630509777771\nModern Horizons 3 Booster Box, 630509777771'}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              rows={8}
              disabled={entryReviewActive}
            />
            <div className="tab-actions">
              <button className="btn-primary" onClick={handleReviewBulk} disabled={!bulkText.trim() || entryReviewActive}>
                Review {bulkLineCount || 0} item{bulkLineCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'csv' && (
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
                onMappingChange={handleColumnMappingChange}
                onConfirm={handleConfirmColumnMappings}
                onCancel={handleCancelColumnMappings}
                rowCount={pendingImport.rawRows.length}
              />
            ) : csvPreview.length > 0 ? (
              <div className="csv-preview">
                <div className="csv-preview-header">
                  <span className="csv-preview-count">{csvPreview.length} rows ready to review</span>
                  <button className="btn-ghost btn-sm" onClick={clearPreview} disabled={entryReviewActive}>Clear</button>
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

                <div className="csv-preview-table-wrapper">
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
                  <button className="btn-primary" onClick={handleReviewCSV} disabled={entryReviewActive}>
                    Review {csvPreview.length} item{csvPreview.length !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            ) : (
              <div className="csv-input-area">
                <div
                  className={`dropzone${isDragging ? ' dropzone--active' : ''}`}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
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
                    onChange={handleFileInput}
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
                  onChange={e => handlePasteTextChange(e.target.value)}
                  rows={8}
                  spellCheck={false}
                />
                <p className="tab-hint" style={{ marginTop: 6 }}>
                  Paste your spreadsheet data above — the first row must be a header row.
                </p>
              </div>
            )}

            {csvError && <div className="form-error-banner" style={{ marginTop: '12px' }}>{csvError}</div>}
            {csvConfirmed && !entryReviewActive && (
              <div className="form-success-banner">
                Items added to queue! Looking up products in the background…
              </div>
            )}
          </div>
        )}

        {activeTab === 'photo' && <PhotoScanTab />}
      </div>

      {entryReviewActive && entryProgress && (
        <div className="photo-batch-progress-banner photo-batch-progress-banner--interactive" role="status" aria-live="polite">
          <span className="photo-batch-progress-count">
            Entry {entryProgress.current} of {entryProgress.total}
          </span>
          {entryProgress.remaining > 0 ? (
            <span className="photo-batch-progress-remaining">
              {entryProgress.remaining} left after this one
            </span>
          ) : (
            <span className="photo-batch-progress-remaining">Last entry</span>
          )}
          <div className="batch-exit-actions">
            {items.length > 0 && (
              <button type="button" className="btn-link btn-sm" onClick={handleExitEntryToReview}>
                Review all →
              </button>
            )}
            <button type="button" className="btn-link btn-sm batch-exit-cancel" onClick={handleCancelEntryBatch}>
              Cancel upload
            </button>
          </div>
        </div>
      )}

      {entryReviewActive && (
        <ProductReviewFlow
          key={`entry-${entryIndex}-${currentDraft?.query ?? ''}-${currentDraft?.originalUpc ?? ''}-${currentDraft?.originalSku ?? ''}`}
          data={entryReviewData}
          loading={entryLookupLoading}
          loadingMessage={`Looking up ${currentDraft?.query ?? 'product'}…`}
          onConfirm={handleConfirmEntry}
          onClose={handleSkipEntry}
          onExitToReview={handleExitEntryToReview}
          onCancelBatch={handleCancelEntryBatch}
          queuedItemCount={items.length}
          batchProgress={entryProgress}
          onApplyConditionToRemaining={handleApplyConditionToRemaining}
        />
      )}

      {items.length > 0 && (
        <div className="upload-queue">
          <div className="section-header">
            <h2 className="section-title">Current Queue ({items.length})</h2>
            <button className="btn-primary btn-sm" onClick={() => navigate('/review')}>
              Review All →
            </button>
          </div>
          <div className="queue-list">
            {[...items].reverse().slice(0, 15).map(item => (
              <div key={item.id} className="queue-item">
                <span className="queue-item-query">{getItemTitle(item)}</span>
                {item.product?.brand && (
                  <span className="queue-item-set text-muted">{item.product.brand}</span>
                )}
                <QueueStatusDot status={item.status} />
              </div>
            ))}
            {items.length > 15 && (
              <p className="text-muted" style={{ padding: '8px 12px', fontSize: '13px' }}>
                +{items.length - 15} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
