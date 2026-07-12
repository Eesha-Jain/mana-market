'use client';

import './page.css';

import { useState, useRef, type DragEvent, type ChangeEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useItems } from '@/contexts/ItemsContext';
import { useToast } from '@/contexts/ToastContext';
import {
  parseTableRaw,
  applyColumnMappings,
  parseCSVFileRaw,
  defaultColumnMappings,
  type RawParsedTable,
  type ColumnMappingChoice,
} from '@/utils/csvParser';
import { getLookupFromRow, parseBulkLine } from '@/utils/productLookup';
import type { CSVRow } from '@/types';
import { PhotoScanTab } from '@/components/upload/PhotoScanTab';
import { ProductReviewFlow } from '@/components/review/ProductReviewFlow';
import { ItemsTable } from '@/components/listings/ItemsTable';
import { TabBar } from '@/components/ui/TabBar';
import { ManualEntryPanel } from '@/components/upload/ManualEntryPanel';
import { CsvImportPanel, type CsvPreviewRow } from '@/components/upload/CsvImportPanel';
import { UPLOAD_TABS, type UploadTabId } from '@/utils/uploadTabs';
import { buildEntryDraft, type EntryReviewDraft } from '@/utils/entryReview';
import { useEntryReviewQueue } from '@/hooks/useEntryReviewQueue';
import { countItemStatuses } from '@/utils/itemStatus';

function buildPreview(rows: CSVRow[]): CsvPreviewRow[] {
  return rows
    .map(r => {
      const { query, originalUpc, originalSku } = getLookupFromRow(r);
      const name = (r.name || '').trim();
      return {
        query,
        displayName: name || query,
        upc: originalUpc || (r.upc || '').trim(),
        sku: originalSku || '',
        quantity: r.quantity || '',
        condition: r.condition || '',
        notes: r.notes || '',
        price: r.price || '',
      };
    })
    .filter(r => r.query.length > 0);
}

function previewRowToDraft(row: CsvPreviewRow): EntryReviewDraft {
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

export default function Page() {
  const { items, addItem, removeItem } = useItems();
  const toast = useToast();
  const router = useRouter();

  const {
    entryReviewActive,
    entryReviewData,
    entryLookupLoading,
    entryBatchProgress,
    currentDraft,
    entryIndex,
    startEntryReview,
    handleConfirmEntry,
    handleSkipEntry,
    handleExitEntryToReview,
    handleCancelEntryBatch,
    handleApplyConditionToRemaining,
  } = useEntryReviewQueue({ addItem });

  const [activeTab, setActiveTab] = useState<UploadTabId>('single');
  const [manualInput, setManualInput] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [hasBarcodes, setHasBarcodes] = useState(false);
  const [pendingImport, setPendingImport] = useState<RawParsedTable | null>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, ColumnMappingChoice>>({});
  const [importSourceLabel, setImportSourceLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { pending, ambiguous, found, notFound } = countItemStatuses(items);

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
    setPendingImport(null);
    setColumnMappings({});
    setImportSourceLabel('');
    const preview = buildPreview(rows);
    if (!preview.length) {
      toast.error(
        `No valid rows found in ${source}. ` +
        'Make sure there is a header row with at least a "Name" or "SKU" column.',
      );
      return;
    }
    setHasBarcodes(preview.some(r => r.upc || r.sku));
    setCsvPreview(preview);
  };

  const handleParsedTable = (parsed: RawParsedTable | null, source: string) => {
    setCsvPreview([]);

    if (!parsed || !parsed.rawRows.length) {
      setPendingImport(null);
      setColumnMappings({});
      setImportSourceLabel('');
      toast.error(
        `No valid rows found in ${source}. ` +
        'Make sure there is a header row with at least a "Name" or "SKU" column.',
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
  };

  const handleColumnMappingChange = (header: string, choice: ColumnMappingChoice) => {
    setColumnMappings(prev => ({ ...prev, [header]: choice }));
  };

  const processFile = async (file: File) => {
    if (!file.name.match(/\.(csv|txt|tsv)$/i)) {
      toast.error('Please upload a .csv, .tsv, or .txt file.');
      return;
    }
    try {
      handleParsedTable(await parseCSVFileRaw(file), `"${file.name}"`);
    } catch {
      toast.error('Failed to parse the file. Is it a valid CSV/TSV?');
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
    toast.success('Items added to your review queue.');
  };

  const clearPreview = () => {
    setCsvPreview([]);
    setPasteText('');
    setPendingImport(null);
    setColumnMappings({});
    setImportSourceLabel('');
  };

  const switchTab = (tab: UploadTabId) => {
    if (entryReviewActive) return;
    setActiveTab(tab);
  };

  const bulkLineCount = bulkText.trim().split(/\r?\n/).filter(Boolean).length;

  const tabPanels: Record<UploadTabId, ReactNode> = {
    single: (
      <ManualEntryPanel
        mode="single"
        value={manualInput}
        onChange={setManualInput}
        onSubmit={handleReviewSingle}
        disabled={entryReviewActive}
      />
    ),
    bulk: (
      <ManualEntryPanel
        mode="bulk"
        value={bulkText}
        onChange={setBulkText}
        onSubmit={handleReviewBulk}
        lineCount={bulkLineCount}
        disabled={entryReviewActive}
      />
    ),
    csv: (
      <CsvImportPanel
        pendingImport={pendingImport}
        columnMappings={columnMappings}
        csvPreview={csvPreview}
        hasBarcodes={hasBarcodes}
        pasteText={pasteText}
        isDragging={isDragging}
        entryReviewActive={entryReviewActive}
        fileInputRef={fileInputRef}
        onMappingChange={handleColumnMappingChange}
        onConfirmMappings={handleConfirmColumnMappings}
        onCancelMappings={handleCancelColumnMappings}
        onClearPreview={clearPreview}
        onReviewCsv={handleReviewCSV}
        onPasteTextChange={handlePasteTextChange}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onFileInput={handleFileInput}
      />
    ),
    photo: <PhotoScanTab />,
  };

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
          <button className="btn-primary" onClick={() => router.push('/review')}>
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
        <TabBar
          tabs={UPLOAD_TABS}
          active={activeTab}
          onChange={switchTab}
          disabled={entryReviewActive}
        />
        {tabPanels[activeTab]}
      </div>

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
          batchProgress={entryBatchProgress}
          onApplyConditionToRemaining={handleApplyConditionToRemaining}
        />
      )}

      {items.length > 0 && (
        <div className="upload-queue">
          <div className="section-header">
            <h2 className="section-title">Current Queue ({items.length})</h2>
            <button className="btn-primary btn-sm" onClick={() => router.push('/review')}>
              Review All →
            </button>
          </div>
          <ItemsTable
            items={[...items].reverse()}
            onRemove={removeItem}
          />
        </div>
      )}
    </div>
  );
}
