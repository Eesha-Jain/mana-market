'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ItemListing, EbayCondition, PricingMode } from '../types';
import { EBAY_CONDITIONS, getItemImageUrl, getItemTitle, getDetectedTitle, getItemListingDescription, patchItemListingDescription } from '../types';
import { resolveItemProductType } from '../utils/productType';
import { useItems } from '../contexts/ItemsContext';
import { formatPrice, getMarketPriceSourceLabel } from '../utils/productApi';
import { resolveItemMarketSelection } from '../utils/marketPrice';
import {
  calculatePrice,
  exportListingsJSON,
  getExportableItems,
  getItemMarketPrice,
  isItemOnEbay,
  isItemReady,
} from '../utils/ebayMapper';
import { AmbiguousModal } from '../components/AmbiguousModal';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { CsvExportModal } from '../components/CsvExportModal';

export function ReviewPage() {
  const { items, updateItem, removeItem, clearItems } = useItems();

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
    if (filter === 'needs_action') {
      return item.status === 'ambiguous' || item.status === 'not_found' || !item.condition;
    }
    return true;
  });

  const readyCount = getExportableItems(items).length;
  const needsCondition = activeItems.filter(i => i.status === 'found' && !i.condition).length;

  const handleApplyConditionToAll = () => {
    if (!bulkApplyCondition) return;
    activeItems
      .filter(i => i.status === 'found' && i.product && !i.condition)
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
          {items.some(i => i.status === 'found') && (
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
        <div className="form-error-banner review-condition-banner" style={{ marginBottom: 16 }}>
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
                   `Needs Action (${activeItems.filter(i =>
                     i.status === 'ambiguous' || i.status === 'not_found' || !i.condition
                   ).length})`}
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
            <div className="review-table-wrapper">
              <table className="review-table">
                <thead>
                  <tr>
                    <th style={{ width: 56 }}></th>
                    <th style={{ width: 88 }}>ID</th>
                    <th>Product</th>
                    <th>Condition</th>
                    <th>Qty</th>
                    <th>Market</th>
                    <th>Pricing</th>
                    <th>Your Price</th>
                    <th>Description</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <ReviewRow
                      key={item.id}
                      item={item}
                      onUpdate={updates => updateItem(item.id, updates)}
                      onRemove={() => removeItem(item.id)}
                      onResolveAmbiguous={() => setAmbiguousItem(item)}
                      onOpenDetail={() => openDetail(item)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
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
                <div className="review-table-wrapper" style={{ marginTop: 0, borderTop: 'none' }}>
                  <table className="review-table">
                    <thead>
                      <tr>
                        <th style={{ width: 56 }}></th>
                        <th style={{ width: 88 }}>ID</th>
                        <th>Product</th>
                        <th>Condition</th>
                        <th>Qty</th>
                        <th>Your Price</th>
                        <th>Exported</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ebayItems.map(item => (
                        <EbayRow
                          key={item.id}
                          item={item}
                          onOpenDetail={() => openDetail(item)}
                          onRemove={() => removeItem(item.id)}
                          onUpdate={updates => updateItem(item.id, updates)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
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
              status: 'found',
              product,
            });
            setAmbiguousItem(null);
          }}
          onClose={() => setAmbiguousItem(null)}
        />
      )}

      {detailItem && (
        <ItemDetailModal
          item={items.find(i => i.id === detailItem.id) ?? detailItem}
          onUpdate={updates => updateItem(detailItem.id, updates)}
          onClose={() => setDetailItem(null)}
          onResolveAmbiguous={
            detailItem.status === 'ambiguous'
              ? () => { setAmbiguousItem(detailItem); setDetailItem(null); }
              : undefined
          }
        />
      )}

      {showCsvExport && (
        <CsvExportModal items={items} onClose={() => setShowCsvExport(false)} />
      )}

      {exportAll && (
        <div className="modal-overlay" onClick={() => setExportAll(false)}>
          <div className="modal modal--wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">eBay AddItem Payloads</h2>
                <p className="modal-subtitle">{readyCount} listing{readyCount !== 1 ? 's' : ''} ready</p>
              </div>
              <button className="modal-close" onClick={() => setExportAll(false)}>✕</button>
            </div>
            <div className="modal-body">
              <pre className="json-preview">{exportListingsJSON(items)}</pre>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={handleExportAll}>↓ Download JSON</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  item: ItemListing;
  onUpdate: (updates: Partial<ItemListing>) => void;
  onRemove: () => void;
  onResolveAmbiguous: () => void;
  onOpenDetail: () => void;
}

function ReviewRow({ item, onUpdate, onRemove, onResolveAmbiguous, onOpenDetail }: RowProps) {
  const product = item.product;
  const img = getItemImageUrl(item);
  const market = getItemMarketPrice(item);
  const marketSelection = resolveItemMarketSelection(item);
  const yourPrice = calculatePrice(item);
  const productType = resolveItemProductType(item);

  if (item.status === 'idle' || item.status === 'searching') {
    return (
      <tr className="row--searching">
        <td colSpan={10}>
          <div className="searching-row">
            <div className="spinner spinner--sm" />
            <span>Looking up <strong>{item.query}</strong>…</span>
          </div>
        </td>
      </tr>
    );
  }

  if (item.status === 'not_found' && !product) {
    return (
      <tr className="row--error row--clickable" onClick={onOpenDetail}>
        <td>
          {img
            ? <img src={img} alt="" className="table-thumb table-thumb--product" />
            : <div className="table-thumb table-thumb--empty">❓</div>}
        </td>
        <td className="item-listing-id-cell">{item.listingId}</td>
        <td colSpan={7}>
          <div className="not-found-row">
            <span className="badge badge--red">Not Found</span>
            <span className="text-muted">"{item.query}"</span>
            <button
              className="btn-secondary btn-sm"
              onClick={e => { e.stopPropagation(); onOpenDetail(); }}
            >
              Edit / Retry →
            </button>
          </div>
        </td>
        <td></td>
        <td>
          <button
            className="btn-icon btn-danger-ghost"
            onClick={e => { e.stopPropagation(); onRemove(); }}
            title="Remove"
          >
            ✕
          </button>
        </td>
      </tr>
    );
  }

  if (item.status === 'ambiguous' && !product) {
    return (
      <tr className="row--warning row--clickable" onClick={onOpenDetail}>
        <td>
          {img
            ? <img src={img} alt="" className="table-thumb table-thumb--product" />
            : <div className="table-thumb table-thumb--empty">⚠️</div>}
        </td>
        <td className="item-listing-id-cell">{item.listingId}</td>
        <td colSpan={7}>
          <div className="ambiguous-row">
            <span className="badge badge--yellow">Ambiguous</span>
            <span>"{item.query}" matched {item.ambiguousResults?.length} products</span>
            <button
              className="btn-secondary btn-sm"
              onClick={e => { e.stopPropagation(); onResolveAmbiguous(); }}
            >
              Select Product →
            </button>
          </div>
        </td>
        <td></td>
        <td>
          <button
            className="btn-icon btn-danger-ghost"
            onClick={e => { e.stopPropagation(); onRemove(); }}
            title="Remove"
          >
            ✕
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="row--clickable" onClick={onOpenDetail}>
      <td>
        <div className="thumb-cell">
          {img
            ? <img src={img} alt={getItemTitle(item)} className="table-thumb table-thumb--product" loading="lazy" />
            : <div className="table-thumb table-thumb--empty">📦</div>
          }
        </div>
      </td>

      <td className="item-listing-id-cell">
        <span className="item-listing-id">{item.listingId}</span>
      </td>

      <td onClick={e => e.stopPropagation()}>
        <div className="card-name-cell">
          <input
            type="text"
            className="inline-input inline-input--title"
            placeholder={getDetectedTitle(item)}
            value={item.customTitle ?? getItemTitle(item)}
            onChange={e => onUpdate({ customTitle: e.target.value || undefined })}
            title="Edit listing title"
          />
          {item.customTitle && item.customTitle !== getDetectedTitle(item) && (
            <span className="text-muted text-sm" style={{ fontSize: '0.72rem' }}>
              Was: {getDetectedTitle(item)}
            </span>
          )}
          {productType && (
            <span className="card-set-info text-muted">{productType}</span>
          )}
          {product?.upc && (
            <span className="card-set-info text-muted">UPC: {product.upc}</span>
          )}
          {!item.condition && (
            <span className="badge badge--yellow" style={{ fontSize: '0.7rem', marginTop: 2 }}>
              Set condition
            </span>
          )}
        </div>
      </td>

      <td onClick={e => e.stopPropagation()}>
        <select
          className={`inline-select${!item.condition ? ' inline-select--required' : ''}`}
          value={item.condition ?? ''}
          onChange={e =>
            onUpdate({
              condition: e.target.value ? (e.target.value as EbayCondition) : null,
            })
          }
        >
          <option value="">Select…</option>
          {EBAY_CONDITIONS.map(c => (
            <option key={c.id} value={c.label} title={c.mtgEquivalent}>
              {c.label}
            </option>
          ))}
        </select>
      </td>

      <td onClick={e => e.stopPropagation()}>
        <input
          type="number"
          className="inline-input inline-input--sm"
          min={1}
          max={999}
          value={item.quantity}
          onChange={e => onUpdate({ quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
        />
      </td>

      <td className="price-cell">
        <span>{formatPrice(market)}</span>
        {marketSelection.source && (
          <span className="text-muted text-sm" style={{ display: 'block', fontSize: '0.72rem' }}>
            {getMarketPriceSourceLabel(marketSelection.source, 'short')}
          </span>
        )}
        {product?.priceRange && (
          <span className="text-muted text-sm" style={{ display: 'block', fontSize: '0.72rem' }}>
            ${product.priceRange.low}–${product.priceRange.high}
          </span>
        )}
      </td>

      <td onClick={e => e.stopPropagation()}>
        <div className="pricing-controls">
          <select
            className="inline-select"
            value={item.pricingMode}
            onChange={e => onUpdate({ pricingMode: e.target.value as PricingMode })}
          >
            <option value="market">Market</option>
            <option value="percent_below">% below</option>
            <option value="manual">Manual</option>
          </select>
          {item.pricingMode === 'percent_below' && (
            <div className="percent-input-row">
              <input
                type="number"
                className="inline-input inline-input--sm"
                min={1}
                max={99}
                value={item.percentBelow}
                onChange={e =>
                  onUpdate({
                    percentBelow: Math.min(99, Math.max(1, parseInt(e.target.value, 10) || 0)),
                  })
                }
              />
              <span className="text-muted">%</span>
            </div>
          )}
          {item.pricingMode === 'manual' && (
            <div className="manual-input-row">
              <span className="text-muted">$</span>
              <input
                type="number"
                className="inline-input inline-input--sm"
                min={0.01}
                step={0.01}
                value={item.manualPrice || ''}
                placeholder="0.00"
                onChange={e => onUpdate({ manualPrice: parseFloat(e.target.value) || 0 })}
              />
            </div>
          )}
        </div>
      </td>

      <td className="price-cell price-cell--final">
        {yourPrice !== null ? `$${yourPrice.toFixed(2)}` : <span className="text-muted">—</span>}
      </td>

      <td onClick={e => e.stopPropagation()}>
        <input
          type="text"
          className="inline-input inline-input--wide"
          placeholder="Description…"
          value={getItemListingDescription(item)}
          onChange={e => onUpdate(patchItemListingDescription(e.target.value))}
        />
      </td>

      <td onClick={e => e.stopPropagation()}>
        <button className="btn-icon btn-danger-ghost" onClick={onRemove} title="Remove">✕</button>
      </td>
    </tr>
  );
}

function EbayRow({
  item,
  onOpenDetail,
  onRemove,
  onUpdate,
}: {
  item: ItemListing;
  onOpenDetail: () => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<ItemListing>) => void;
}) {
  const img = getItemImageUrl(item);
  const yourPrice = calculatePrice(item);

  return (
    <tr className="row--clickable row--ebay" onClick={onOpenDetail}>
      <td>
        {img
          ? <img src={img} alt="" className="table-thumb table-thumb--product" loading="lazy" />
          : <div className="table-thumb table-thumb--empty">✓</div>}
      </td>
      <td className="item-listing-id-cell">
        <span className="item-listing-id">{item.listingId}</span>
      </td>
      <td><span className="item-name">{getItemTitle(item)}</span></td>
      <td>{item.condition ?? '—'}</td>
      <td>{item.quantity}</td>
      <td className="price-cell">
        {yourPrice !== null ? `$${yourPrice.toFixed(2)}` : '—'}
      </td>
      <td className="text-muted text-sm">
        {item.ebayExportedAt
          ? new Date(item.ebayExportedAt).toLocaleDateString()
          : '—'}
      </td>
      <td onClick={e => e.stopPropagation()}>
        <select
          className="inline-select"
          value={item.ebayListingStatus ?? 'exported'}
          onChange={e =>
            onUpdate({
              ebayListingStatus: e.target.value as ItemListing['ebayListingStatus'],
            })
          }
        >
          <option value="exported">Exported</option>
          <option value="active">Active</option>
          <option value="sold">Sold</option>
          <option value="ended">Ended</option>
        </select>
      </td>
      <td onClick={e => e.stopPropagation()}>
        <button className="btn-icon btn-danger-ghost" onClick={onRemove} title="Remove">✕</button>
      </td>
    </tr>
  );
}
