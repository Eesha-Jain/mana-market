'use client';

import './page.css';

import { useState } from 'react';
import Link from 'next/link';
import type { ItemListing, EbayCondition } from '@/types';
import { EBAY_CONDITIONS, ITEM_STATUS } from '@/types';
import { useItems } from '@/contexts/ItemsContext';
import { useToast } from '@/contexts/ToastContext';
import {
  exportListingsJSON,
  getExportableItems,
  isItemOnEbay,
  isItemReady,
} from '@/utils/ebayMapper';
import {
  isItemFound,
  isItemFoundMissingCondition,
  isItemFoundWithProduct,
  isItemNeedsAction,
} from '@/utils/itemStatus';
import { AmbiguousModal } from '@/components/review/AmbiguousModal';
import { ItemModal } from '@/components/listings/ItemModal';
import { ItemsTable } from '@/components/listings/ItemsTable';
import { Modal } from '@/components/ui/Modal';
import { CsvExportModal } from '@/components/upload/CsvExportModal';

export default function Page() {
  const { items, updateItem, removeItem, clearItems } = useItems();
  const toast = useToast();

  const [ambiguousItem, setAmbiguousItem] = useState<ItemListing | null>(null);
  const [detailItem, setDetailItem] = useState<ItemListing | null>(null);
  const [exportAll, setExportAll] = useState(false);
  const [showCsvExport, setShowCsvExport] = useState(false);
  const [ebaySectionOpen, setEbaySectionOpen] = useState(false);

  const [filter, setFilter] = useState<'all' | 'ready' | 'needs_action'>('all');
  const [bulkApplyCondition, setBulkApplyCondition] = useState<EbayCondition | ''>('');

  const activeItems = items.filter(i => !isItemOnEbay(i));
  const ebayItems = items.filter(i => isItemOnEbay(i));

  const filtered = activeItems.filter(item => {
    if (filter === 'ready') return isItemReady(item);
    if (filter === 'needs_action') return isItemNeedsAction(item);
    return true;
  });

  const readyCount = getExportableItems(items).length;
  const needsCondition = activeItems.filter(isItemFoundMissingCondition).length;

  const handleApplyConditionToAll = () => {
    if (!bulkApplyCondition) return;
    activeItems
      .filter(isItemFoundWithProduct)
      .filter(i => !i.condition)
      .forEach(item => updateItem(item.id, { condition: bulkApplyCondition }));
  };

  const handleExportAll = () => {
    const exportable = getExportableItems(items);
    const json = exportListingsJSON(items);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ebay_listings_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const now = new Date().toISOString();
    exportable.forEach(item => {
      updateItem(item.id, {
        ebayExportedAt: now,
        ebayListingStatus: 'exported',
      });
    });
    setExportAll(false);
    toast.success(
      `Exported ${exportable.length} listing${exportable.length !== 1 ? 's' : ''} to JSON. Paste each live eBay URL in item details after listing.`,
    );
  };

  const openDetail = (item: ItemListing) => {
    setDetailItem(items.find(i => i.id === item.id) ?? item);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Review &amp; Price</h1>
          <p className="page-subtitle">
            Set condition and pricing for each product before exporting. Click any row to edit all details.
          </p>
        </div>
        <div className="page-actions">
          {items.some(isItemFound) && (
            <button className="btn-ghost" onClick={() => setShowCsvExport(true)}>
              ↓ Export CSV
            </button>
          )}
          {readyCount > 0 && (
            <>
              <button className="btn-ghost" onClick={() => setExportAll(true)}>
                Preview All JSON
              </button>
              <button className="btn-primary" onClick={handleExportAll}>
                ↓ Export {readyCount} to eBay
              </button>
            </>
          )}
        </div>
      </div>

      {needsCondition > 0 && (
        <div className="form-warning-banner review-condition-banner" style={{ marginBottom: 16 }}>
          <span>
            {needsCondition} item{needsCondition !== 1 ? 's' : ''} need a condition set before export.
          </span>
          {needsCondition > 1 && (
            <div className="review-bulk-condition">
              <select
                className="inline-select"
                value={bulkApplyCondition}
                onChange={e => setBulkApplyCondition(e.target.value as EbayCondition | '')}
                aria-label="Condition to apply to all items"
              >
                <option value="">Choose condition…</option>
                {EBAY_CONDITIONS.map(c => (
                  <option key={c.id} value={c.label}>{c.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={!bulkApplyCondition}
                onClick={handleApplyConditionToAll}
              >
                Apply to all {needsCondition} items
              </button>
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-state-section">
          <div className="empty-icon">📋</div>
          <h2>Nothing to review yet</h2>
          <p>Go to Upload to add items first.</p>
          <Link href="/upload" className="btn-primary">Upload Items</Link>
        </div>
      ) : (
        <>
          <div className="review-toolbar">
            <div className="filter-tabs">
              {(['all', 'ready', 'needs_action'] as const).map(f => (
                <button
                  key={f}
                  className={`filter-tab${filter === f ? ' active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? `All (${activeItems.length})` :
                   f === 'ready' ? `Ready (${readyCount})` :
                   `Needs Action (${activeItems.filter(isItemNeedsAction).length})`}
                </button>
              ))}
            </div>
            <button
              className="btn-danger btn-sm"
              onClick={() => { if (confirm('Clear all items?')) clearItems(); }}
            >
              Clear All
            </button>
          </div>

          {filtered.length === 0 ? (
            <p className="text-muted" style={{ padding: '32px 0' }}>No items match this filter.</p>
          ) : (
            <ItemsTable
              items={filtered}
              variant="review"
              onRowClick={openDetail}
              onRemove={removeItem}
              onUpdate={(id, updates) => updateItem(id, updates)}
              onResolveAmbiguous={setAmbiguousItem}
            />
          )}

          {ebayItems.length > 0 && (
            <div className="ebay-collapsed-section">
              <button
                className="ebay-collapsed-header"
                onClick={() => setEbaySectionOpen(o => !o)}
                aria-expanded={ebaySectionOpen}
              >
                <span className="ebay-collapsed-chevron">{ebaySectionOpen ? '▼' : '▶'}</span>
                <span>Already in eBay ({ebayItems.length})</span>
              </button>
              {ebaySectionOpen && (
                <ItemsTable
                  items={ebayItems}
                  variant="exported"
                  onRowClick={openDetail}
                  onRemove={removeItem}
                  onUpdate={(id, updates) => updateItem(id, updates)}
                />
              )}
            </div>
          )}
        </>
      )}

      {ambiguousItem && ambiguousItem.ambiguousResults && (
        <AmbiguousModal
          query={ambiguousItem.query}
          results={ambiguousItem.ambiguousResults}
          onSelect={product => {
            updateItem(ambiguousItem.id, {
              status: ITEM_STATUS.Found,
              product,
            });
            setAmbiguousItem(null);
          }}
          onClose={() => setAmbiguousItem(null)}
        />
      )}

      {detailItem && (
        <ItemModal
          key={detailItem.id}
          mode="detail"
          item={items.find(i => i.id === detailItem.id) ?? detailItem}
          onClose={() => setDetailItem(null)}
          onResolveAmbiguous={
            detailItem.status === ITEM_STATUS.Ambiguous
              ? () => { setAmbiguousItem(detailItem); setDetailItem(null); }
              : undefined
          }
        />
      )}

      {showCsvExport && (
        <CsvExportModal items={items} onClose={() => setShowCsvExport(false)} />
      )}

      {exportAll && (
        <Modal
          wide
          title="eBay AddItem Payloads"
          subtitle={`${readyCount} listing${readyCount !== 1 ? 's' : ''} ready`}
          onClose={() => setExportAll(false)}
          footer={
            <button type="button" className="btn-primary" onClick={handleExportAll}>
              ↓ Download JSON
            </button>
          }
        >
          <pre className="json-preview">{exportListingsJSON(items)}</pre>
        </Modal>
      )}
    </div>
  );
}
