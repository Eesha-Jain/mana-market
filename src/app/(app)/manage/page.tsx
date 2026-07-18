'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useInventory } from '@/contexts/InventoryContext';
import { useToast } from '@/contexts/ToastContext';
import {
  MARKETPLACE_LABELS,
  MARKETPLACE_PLATFORMS,
  WORKFLOW_STATUS,
  type MarketplacePlatform,
  type UserItemWithCatalog,
  type WorkflowStatus,
} from '@/types';
import { TabBar } from '@/components/ui/TabBar';
import { InventoryItemsView } from '@/components/inventory/InventoryItemsView';
import { InventoryViewToggle } from '@/components/inventory/InventoryViewToggle';
import { UserItemModal } from '@/components/inventory/UserItemModal';
import { CsvExportModal } from '@/components/upload/CsvExportModal';
import { useInventoryViewMode } from '@/hooks/useInventoryViewMode';
import { filterByWorkflow, filterLiveItems, hasConfirmedListingPrice } from '@/utils/items';
import { getAccessToken } from '@/lib/supabase/client';
import {
  delistSoldFromOtherPlatformsAction,
  listOnMarketplaceAction,
  syncAllLiveItemsAction,
} from '@/lib/marketplaces/actions';
import { deleteSoldUserItemsAction } from '@/lib/inventory/actions';
import './page.css';

type ManageTab = 'draft' | 'reviewed' | 'ready' | 'live';
type LiveFilter = 'all' | 'listed' | 'sold' | 'csv';

const MANAGE_TABS = [
  { id: 'draft' as const, label: 'Draft' },
  { id: 'reviewed' as const, label: 'Reviewed' },
  { id: 'ready' as const, label: 'Ready to export' },
  { id: 'live' as const, label: 'Live' },
];

function tabToWorkflow(tab: ManageTab): WorkflowStatus | 'live' {
  if (tab === 'draft') return WORKFLOW_STATUS.Draft;
  if (tab === 'reviewed') return WORKFLOW_STATUS.Reviewed;
  if (tab === 'ready') return WORKFLOW_STATUS.Ready;
  return 'live';
}

function isCsvExportedOnly(item: UserItemWithCatalog): boolean {
  return (
    item.workflowStatus === WORKFLOW_STATUS.Listed &&
    Object.keys(item.marketplaceListings).length === 0
  );
}

export default function ManagePage() {
  const { items, updateItem, removeItem, refreshItems } = useInventory();
  const toast = useToast();
  const { viewMode, setViewMode } = useInventoryViewMode();
  const [activeTab, setActiveTab] = useState<ManageTab>('draft');
  const [liveFilter, setLiveFilter] = useState<LiveFilter>('all');
  const [selectedItem, setSelectedItem] = useState<UserItemWithCatalog | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<MarketplacePlatform[]>([
    'ebay',
  ]);

  const tabItems = useMemo(() => {
    const workflow = tabToWorkflow(activeTab);
    if (workflow === 'live') {
      const live = filterLiveItems(items);
      if (liveFilter === 'listed') {
        return live.filter(i => i.workflowStatus === WORKFLOW_STATUS.Listed && !isCsvExportedOnly(i));
      }
      if (liveFilter === 'sold') {
        return live.filter(i => i.workflowStatus === WORKFLOW_STATUS.Sold);
      }
      if (liveFilter === 'csv') {
        return live.filter(isCsvExportedOnly);
      }
      return live;
    }
    return filterByWorkflow(items, workflow);
  }, [items, activeTab, liveFilter]);

  const readyItems = useMemo(
    () => filterByWorkflow(items, WORKFLOW_STATUS.Ready),
    [items],
  );

  const selectedTabItems = useMemo(
    () => tabItems.filter(i => selectedIds.has(i.id)),
    [tabItems, selectedIds],
  );

  const clearSelection = () => setSelectedIds(new Set());

  const setTab = (tab: ManageTab) => {
    setActiveTab(tab);
    clearSelection();
    setSelectedItem(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (tabItems.length > 0 && tabItems.every(i => selectedIds.has(i.id))) {
      clearSelection();
      return;
    }
    setSelectedIds(new Set(tabItems.map(i => i.id)));
  };

  const moveSelected = (status: WorkflowStatus, label: string) => {
    if (!selectedTabItems.length) return;
    for (const item of selectedTabItems) {
      updateItem(item.id, { workflowStatus: status });
    }
    toast.success(
      `Moved ${selectedTabItems.length} item${selectedTabItems.length !== 1 ? 's' : ''} to ${label}`,
    );
    clearSelection();
  };

  const handleOpenItem = (item: UserItemWithCatalog) => {
    if (item.workflowStatus === WORKFLOW_STATUS.Ready) {
      toast.info('Move this item back to Reviewed to edit it.');
      return;
    }
    setSelectedItem(item);
  };

  const handleSaveItem = (updates: Partial<UserItemWithCatalog>) => {
    if (!selectedItem) return;
    const nextPrice = updates.price ?? selectedItem.price;
    const nextStatus =
      selectedItem.workflowStatus === WORKFLOW_STATUS.Draft &&
      hasConfirmedListingPrice(nextPrice)
        ? WORKFLOW_STATUS.Reviewed
        : selectedItem.workflowStatus === WORKFLOW_STATUS.Reviewed &&
            !hasConfirmedListingPrice(nextPrice)
          ? WORKFLOW_STATUS.Draft
          : selectedItem.workflowStatus;

    updateItem(selectedItem.id, { ...updates, workflowStatus: nextStatus });
    setSelectedItem(prev => (prev ? { ...prev, ...updates, workflowStatus: nextStatus } : null));
  };

  const handleListSelected = async () => {
    const targets = selectedTabItems.length ? selectedTabItems : readyItems;
    if (!targets.length) return;
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      for (const item of targets) {
        for (const platform of selectedPlatforms) {
          const updated = await listOnMarketplaceAction(token, item.id, platform);
          updateItem(item.id, updated);
        }
      }
      toast.success(`Listed ${targets.length} item(s) on selected platforms`);
      clearSelection();
      await refreshItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Listing failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshLive = async () => {
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const count = await syncAllLiveItemsAction(token);
      await refreshItems();
      toast.success(`Refreshed ${count} live item(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelistSoldElsewhere = async () => {
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const count = await delistSoldFromOtherPlatformsAction(token);
      await refreshItems();
      toast.success(`Processed ${count} sold item(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delist failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveSold = async () => {
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const count = await deleteSoldUserItemsAction(token);
      await refreshItems();
      toast.success(`Removed ${count} sold item(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSelected = () => {
    if (!selectedTabItems.length) return;
    for (const item of selectedTabItems) {
      removeItem(item.id);
    }
    toast.success(`Removed ${selectedTabItems.length} item(s)`);
    clearSelection();
  };

  const handleCsvExported = (exported: UserItemWithCatalog[]) => {
    for (const item of exported) {
      updateItem(item.id, { workflowStatus: WORKFLOW_STATUS.Listed });
    }
    toast.success(
      `Exported ${exported.length} item${exported.length !== 1 ? 's' : ''} — moved to Live`,
    );
    clearSelection();
  };

  const togglePlatform = (platform: MarketplacePlatform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform],
    );
  };

  const exportTargets = selectedTabItems.length ? selectedTabItems : readyItems;
  const canSelect = activeTab === 'reviewed' || activeTab === 'ready' || activeTab === 'live';

  return (
    <div className="page manage-page">
      <div className="page-header manage-header">
        <div>
          <h1 className="page-title">Manage Items</h1>
          <p className="page-subtitle">
            Draft → Reviewed → Ready to export → Live. Select items in bulk to move them through the pipeline.
          </p>
        </div>
        <Link href="/upload" className="btn-primary">
          Upload items
        </Link>
      </div>

      <div className="manage-toolbar organic-panel">
        <TabBar tabs={MANAGE_TABS} active={activeTab} onChange={setTab} />
        <div className="manage-toolbar-actions">
          <InventoryViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {activeTab === 'draft' && tabItems.length === 0 && (
        <div className="empty-state organic-panel">
          <h2>Draft items appear here</h2>
          <p>Upload inventory, then confirm a price in review to mark items as Reviewed.</p>
          <Link href="/upload" className="btn-primary">Go to Upload</Link>
        </div>
      )}

      {activeTab === 'reviewed' && (
        <div className="manage-ready-actions organic-panel">
          <p className="text-muted-sm">
            {tabItems.length} reviewed item{tabItems.length !== 1 ? 's' : ''}. Select items to queue for export.
          </p>
          <div className="manage-action-row">
            <button
              type="button"
              className="btn-ghost"
              onClick={toggleSelectAll}
              disabled={!tabItems.length}
            >
              {tabItems.length > 0 && tabItems.every(i => selectedIds.has(i.id))
                ? 'Clear selection'
                : 'Select all'}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => moveSelected(WORKFLOW_STATUS.Ready, 'Ready to export')}
              disabled={!selectedTabItems.length}
            >
              Move {selectedTabItems.length || ''} to Ready to export
            </button>
          </div>
        </div>
      )}

      {activeTab === 'ready' && (
        <div className="manage-ready-actions organic-panel">
          <p className="text-muted-sm">
            {readyItems.length} item{readyItems.length !== 1 ? 's' : ''} ready to export.
            Editing is locked — move back to Reviewed to change details.
          </p>
          <div className="platform-picker">
            {MARKETPLACE_PLATFORMS.map(platform => (
              <label key={platform} className="platform-chip">
                <input
                  type="checkbox"
                  checked={selectedPlatforms.includes(platform)}
                  onChange={() => togglePlatform(platform)}
                />
                {MARKETPLACE_LABELS[platform]}
              </label>
            ))}
          </div>
          <div className="manage-action-row">
            <button
              type="button"
              className="btn-ghost"
              onClick={toggleSelectAll}
              disabled={!tabItems.length}
            >
              {tabItems.length > 0 && tabItems.every(i => selectedIds.has(i.id))
                ? 'Clear selection'
                : 'Select all'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => moveSelected(WORKFLOW_STATUS.Reviewed, 'Reviewed')}
              disabled={!selectedTabItems.length}
            >
              Move back to Reviewed
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setExportOpen(true)}
              disabled={!exportTargets.length}
            >
              Export CSV ({exportTargets.length})
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleListSelected()}
              disabled={!exportTargets.length || !selectedPlatforms.length || busy}
            >
              List on selected platforms
            </button>
          </div>
        </div>
      )}

      {activeTab === 'live' && (
        <div className="manage-live-actions organic-panel">
          <div className="live-filter-row">
            {(
              [
                ['all', 'All'],
                ['listed', 'Marketplace'],
                ['csv', 'CSV exported'],
                ['sold', 'Sold'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`view-toggle-btn${liveFilter === id ? ' active' : ''}`}
                onClick={() => setLiveFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary" onClick={() => void handleRefreshLive()} disabled={busy}>
            Refresh status
          </button>
          <button type="button" className="btn-secondary" onClick={() => void handleDelistSoldElsewhere()} disabled={busy}>
            Delist sold items from other marketplaces
          </button>
          <button type="button" className="btn-ghost" onClick={() => void handleRemoveSold()} disabled={busy}>
            Remove sold from Mana Market
          </button>
          <button
            type="button"
            className="btn-danger btn-ghost"
            onClick={handleDeleteSelected}
            disabled={!selectedTabItems.length}
          >
            Delete selected ({selectedTabItems.length || 0})
          </button>
        </div>
      )}

      {tabItems.length > 0 && (
        <InventoryItemsView
          items={tabItems}
          viewMode={viewMode}
          onSelect={handleOpenItem}
          onRemove={removeItem}
          selectable={canSelect}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          allowRemove={activeTab !== 'ready'}
        />
      )}

      {selectedItem && activeTab !== 'ready' && (
        <UserItemModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSave={handleSaveItem}
          onDelete={() => {
            removeItem(selectedItem.id);
            setSelectedItem(null);
          }}
          saveAsDraftLabel={
            selectedItem.workflowStatus === WORKFLOW_STATUS.Draft ||
            selectedItem.workflowStatus === WORKFLOW_STATUS.Reviewed
              ? 'Save as draft'
              : undefined
          }
          onSaveAsDraft={updates => {
            updateItem(selectedItem.id, { ...updates, workflowStatus: WORKFLOW_STATUS.Draft });
            setSelectedItem(null);
          }}
        />
      )}

      {exportOpen && (
        <CsvExportModal
          items={exportTargets}
          onClose={() => setExportOpen(false)}
          onExported={handleCsvExported}
        />
      )}
    </div>
  );
}
