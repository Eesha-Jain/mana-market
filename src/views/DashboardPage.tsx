'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemsContext';
import { formatPrice } from '../utils/productApi';
import { calculatePrice, getItemMarketPrice, isItemReady } from '../utils/ebayMapper';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { getItemImageUrl, getItemTitle } from '../types';

export function DashboardPage() {
  const { user } = useAuth();
  const { items, removeItem, clearItems, updateItem } = useItems();
  const [detailItem, setDetailItem] = useState<string | null>(null);

  const found = items.filter(i => isItemReady(i));
  const pending = items.filter(i => i.status === 'idle' || i.status === 'searching');
  const ambiguous = items.filter(i => i.status === 'ambiguous');
  const notFound = items.filter(i => i.status === 'not_found');

  const totalValue = found.reduce((sum, item) => {
    const price = calculatePrice(item);
    return sum + (price ?? 0) * item.quantity;
  }, 0);

  const selectedItem = detailItem ? items.find(i => i.id === detailItem) : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user?.name}</h1>
          <p className="page-subtitle">Here's an overview of your current batch.</p>
        </div>
        <div className="page-actions">
          <Link href="/upload" className="btn-primary">+ Add Items</Link>
          {items.length > 0 && (
            <Link href="/review" className="btn-secondary">Review & Price →</Link>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{items.length}</span>
          <span className="stat-label">Total Items</span>
        </div>
        <div className="stat-card stat-card--green">
          <span className="stat-value">{found.length}</span>
          <span className="stat-label">Ready to List</span>
        </div>
        <div className="stat-card stat-card--yellow">
          <span className="stat-value">{pending.length + ambiguous.length}</span>
          <span className="stat-label">Needs Attention</span>
        </div>
        <div className="stat-card stat-card--red">
          <span className="stat-value">{notFound.length}</span>
          <span className="stat-label">Not Found</span>
        </div>
        <div className="stat-card stat-card--gold">
          <span className="stat-value">${totalValue.toFixed(2)}</span>
          <span className="stat-label">Est. Total Value</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-dashboard">
          <div className="empty-dashboard-icon">📦</div>
          <h2>No items yet</h2>
          <p>Upload product names, a CSV file, or scan a photo to get started.</p>
          <Link href="/upload" className="btn-primary">Upload Items</Link>
        </div>
      ) : (
        <div className="dashboard-table-section">
          <div className="section-header">
            <h2 className="section-title">Your Items</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link href="/review" className="btn-secondary btn-sm">Edit & Price</Link>
              <button className="btn-danger btn-sm" onClick={() => {
                if (confirm('Clear all items? This cannot be undone.')) clearItems();
              }}>
                Clear All
              </button>
            </div>
          </div>

          <div className="items-table-wrapper">
            <table className="items-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th style={{ width: 88 }}>ID</th>
                  <th>Product</th>
                  <th>UPC / Brand</th>
                  <th>Condition</th>
                  <th>Qty</th>
                  <th>Market</th>
                  <th>Your Price</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const product = item.product;
                  const img = getItemImageUrl(item);
                  const market = getItemMarketPrice(item);
                  const yourPrice = calculatePrice(item);

                  return (
                    <tr
                      key={item.id}
                      className="row--clickable"
                      onClick={() => setDetailItem(item.id)}
                    >
                      <td>
                        {img
                          ? <img src={img} alt={getItemTitle(item)} className="table-thumb table-thumb--product" loading="lazy" />
                          : <div className="table-thumb table-thumb--empty">📦</div>
                        }
                      </td>
                      <td className="item-listing-id-cell">
                        <span className="item-listing-id">{item.listingId}</span>
                      </td>
                      <td>
                        <span className="item-name">{getItemTitle(item)}</span>
                        {item.ebayExportedAt && (
                          <span className="badge badge--gray" style={{ marginLeft: 6, fontSize: '0.7rem' }}>
                            eBay
                          </span>
                        )}
                      </td>
                      <td className="text-muted">
                        {[
                          product?.upc ? `UPC: ${product.upc}` : item.originalUpc ? `UPC: ${item.originalUpc}` : null,
                          item.originalSku ? `SKU: ${item.originalSku}` : null,
                          !product?.upc && !item.originalUpc && !item.originalSku ? (product?.brand ?? '—') : null,
                        ].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td>{item.condition ?? <span className="text-muted">Not set</span>}</td>
                      <td>{item.quantity}</td>
                      <td>{formatPrice(market)}</td>
                      <td className="price-cell">
                        {yourPrice !== null ? `$${yourPrice.toFixed(2)}` : '—'}
                      </td>
                      <td><StatusBadge status={item.status} hasCondition={!!item.condition} /></td>
                      <td onClick={e => e.stopPropagation()}>
                        <button
                          className="btn-icon btn-danger-ghost"
                          title="Remove item"
                          onClick={() => removeItem(item.id)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onUpdate={updates => updateItem(selectedItem.id, updates)}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status, hasCondition }: { status: string; hasCondition: boolean }) {
  const map: Record<string, { label: string; cls: string }> = {
    idle:       { label: 'Queued',     cls: 'badge--gray' },
    searching:  { label: 'Searching…', cls: 'badge--blue badge--pulse' },
    found:      { label: hasCondition ? 'Ready' : 'Set condition', cls: hasCondition ? 'badge--green' : 'badge--yellow' },
    ambiguous:  { label: 'Ambiguous',  cls: 'badge--yellow' },
    not_found:  { label: 'Not Found',  cls: 'badge--red' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'badge--gray' };
  return <span className={`badge ${cls}`}>{label}</span>;
}
