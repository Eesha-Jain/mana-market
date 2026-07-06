'use client';

import './page.css';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useItems } from '@/contexts/ItemsContext';
import { calculatePrice, isItemReady } from '@/utils/ebayMapper';
import {
  isItemAmbiguous,
  isItemNotFound,
  isItemPending,
} from '@/utils/itemStatus';
import { ItemModal } from '@/components/listings/ItemModal';
import { ItemsTable } from '@/components/listings/ItemsTable';

export default function Page() {
  const { user } = useAuth();
  const { items, removeItem, clearItems } = useItems();
  const [detailItem, setDetailItem] = useState<string | null>(null);

  const found = items.filter(i => isItemReady(i));
  const pending = items.filter(isItemPending);
  const ambiguous = items.filter(isItemAmbiguous);
  const notFound = items.filter(isItemNotFound);

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

          <ItemsTable
            items={items}
            onRowClick={item => setDetailItem(item.id)}
            onRemove={removeItem}
          />
        </div>
      )}

      {selectedItem && (
        <ItemModal
          key={selectedItem.id}
          mode="detail"
          item={selectedItem}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}
