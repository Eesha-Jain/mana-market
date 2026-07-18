'use client';

import { useRef, useState } from 'react';
import type { ItemSource, LookupStatus, Product, UserItemWithCatalog, WorkflowStatus } from '@/types';
import { LOOKUP_STATUS, WORKFLOW_STATUS } from '@/types';
import type { EntryReviewDraft } from '@/utils/review';
import {
  buildEntryProductReviewData,
  type ProductReviewConfirmPayload,
  type ProductReviewData,
} from '@/utils/review';
import { lookupStatusFromMatch, workflowAfterReviewConfirm } from '@/utils/items';
import { calculateDraftPrice } from '@/utils/pricing';

interface QueuedEntry extends EntryReviewDraft {
  itemId: string;
}

interface UseEntryReviewQueueOptions {
  addItem: (
    query: string,
    source?: ItemSource,
    overrides?: Partial<UserItemWithCatalog> & { product?: Product },
  ) => Promise<UserItemWithCatalog>;
  applyReviewToItem: (
    id: string,
    updates: Partial<UserItemWithCatalog> & { product?: Product },
  ) => Promise<UserItemWithCatalog>;
  removeItem: (id: string) => void;
}

function productFromReviewData(data: ProductReviewData | null): Product | null {
  if (!data) return null;
  return data.matchedProduct ?? data.suggestedProduct ?? data.ambiguousResults?.[0] ?? null;
}

function lookupStatusFromReviewData(data: ProductReviewData | null): LookupStatus {
  if (!data) return LOOKUP_STATUS.Idle;
  if (data.ambiguousResults?.length && !data.matchedProduct && !data.suggestedProduct) {
    return LOOKUP_STATUS.Ambiguous;
  }
  return lookupStatusFromMatch(!!productFromReviewData(data));
}

function stubOverridesFromDraft(draft: EntryReviewDraft) {
  return {
    originalUpc: draft.originalUpc ?? null,
    originalSku: draft.originalSku ?? null,
    quantity: draft.quantity,
    condition: draft.condition,
    notes: draft.description,
    customDescription: draft.description || null,
    customTitle: draft.query || null,
    pricingMode: (draft.manualPrice > 0 ? 'manual' : 'market') as 'manual' | 'market',
    percentBelow: 10,
    price: draft.manualPrice > 0 ? draft.manualPrice : 0,
    workflowStatus: WORKFLOW_STATUS.Draft,
    lookupStatus: LOOKUP_STATUS.Idle,
  };
}

function reviewUpdatesFromPayload(
  payload: ProductReviewConfirmPayload,
  workflowStatus: WorkflowStatus,
) {
  const marketPrice = payload.product?.marketPrice ?? null;
  const price =
    calculateDraftPrice(marketPrice, {
      pricingMode: payload.pricingMode,
      percentBelow: payload.percentBelow,
      manualPrice: payload.price,
    }) ?? payload.price;

  return {
    query: payload.query,
    customTitle: payload.customTitle,
    customDescription: payload.customDescription,
    originalUpc: payload.originalUpc,
    originalSku: payload.originalSku,
    quantity: payload.quantity,
    condition: payload.condition,
    pricingMode: payload.pricingMode,
    percentBelow: payload.percentBelow,
    price,
    pricingSource: payload.pricingSource ?? 'amazon',
    selectedMarketPriceSource: payload.selectedMarketPriceSource,
    photoUrl: payload.photoUrl,
    userImageUrl: payload.userImageUrl,
    preferredImageSource: payload.preferredImageSource,
    imageUrl: payload.selectedImageUrls?.[0] ?? payload.selectedImageUrl ?? null,
    imageUrls:
      payload.selectedImageUrls ??
      (payload.selectedImageUrl ? [payload.selectedImageUrl] : []),
    lookupStatus: lookupStatusFromMatch(!!payload.product),
    product: payload.product,
    category: payload.category,
    notes: payload.notes ?? '',
    workflowStatus,
  };
}

export function useEntryReviewQueue({
  addItem,
  applyReviewToItem,
  removeItem,
}: UseEntryReviewQueueOptions) {
  const [entryQueue, setEntryQueue] = useState<QueuedEntry[]>([]);
  const [entryIndex, setEntryIndex] = useState(0);
  const [entryReviewActive, setEntryReviewActive] = useState(false);
  const [entryReviewData, setEntryReviewData] = useState<ProductReviewData | null>(null);
  const [entryLookupLoading, setEntryLookupLoading] = useState(false);
  const [entrySavingRemaining, setEntrySavingRemaining] = useState(false);
  const [entryBootstrapping, setEntryBootstrapping] = useState(false);

  const entryQueueRef = useRef(entryQueue);
  const entryIndexRef = useRef(entryIndex);
  const entryReviewActiveRef = useRef(entryReviewActive);
  const entryReviewDataRef = useRef(entryReviewData);
  entryQueueRef.current = entryQueue;
  entryIndexRef.current = entryIndex;
  entryReviewActiveRef.current = entryReviewActive;
  entryReviewDataRef.current = entryReviewData;

  const finishEntryQueue = () => {
    setEntryQueue([]);
    setEntryIndex(0);
    setEntryReviewActive(false);
    setEntryReviewData(null);
    setEntryLookupLoading(false);
    setEntrySavingRemaining(false);
    setEntryBootstrapping(false);
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
      setEntryReviewData(data);
    } finally {
      setEntryLookupLoading(false);
    }
  };

  const startEntryReview = (drafts: EntryReviewDraft[]) => {
    if (!drafts.length || entryReviewActiveRef.current || entryBootstrapping) return;

    setEntryBootstrapping(true);
    setEntryReviewActive(true);
    setEntryIndex(0);
    setEntryQueue([]);
    setEntryReviewData(null);

    void (async () => {
      const queued: QueuedEntry[] = [];
      try {
        for (const draft of drafts) {
          const item = await addItem(draft.query, draft.source, stubOverridesFromDraft(draft));
          queued.push({ ...draft, itemId: item.id });
        }
        setEntryQueue(queued);
        entryQueueRef.current = queued;
        setEntryBootstrapping(false);
        await processEntryDraftAt(0, queued);
      } catch {
        for (const entry of queued) {
          removeItem(entry.itemId);
        }
        finishEntryQueue();
      }
    })();
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

  const persistConfirm = async (
    payload: ProductReviewConfirmPayload,
    leaveAsDraft: boolean,
  ) => {
    const current = entryQueueRef.current[entryIndexRef.current];
    if (!current) return;

    const marketPrice = payload.product?.marketPrice ?? null;
    const price =
      calculateDraftPrice(marketPrice, {
        pricingMode: payload.pricingMode,
        percentBelow: payload.percentBelow,
        manualPrice: payload.price,
      }) ?? payload.price;

    const workflowStatus = workflowAfterReviewConfirm(price, leaveAsDraft);
    await applyReviewToItem(current.itemId, reviewUpdatesFromPayload(payload, workflowStatus));
  };

  const handleConfirmEntry = (payload: ProductReviewConfirmPayload, leaveAsDraft = false) => {
    void persistConfirm(payload, leaveAsDraft).then(() => {
      setEntryReviewData(null);
      advanceEntryQueue();
    });
  };

  const handleSkipEntry = () => {
    setEntryReviewData(null);
    advanceEntryQueue();
  };

  const entrySavingRef = useRef(false);

  /** Close the batch: enrich remaining drafts (already stubbed), keep as draft. */
  const handleExitSaveRemaining = async (): Promise<number> => {
    if (entrySavingRef.current) return 0;

    const drafts = entryQueueRef.current;
    const startIndex = entryIndexRef.current;
    const remaining = drafts.slice(startIndex);
    if (!remaining.length) {
      finishEntryQueue();
      return 0;
    }

    entrySavingRef.current = true;
    const currentReview = entryReviewDataRef.current;
    setEntrySavingRemaining(true);
    setEntryLookupLoading(false);
    setEntryReviewData(null);

    try {
      for (let i = 0; i < remaining.length; i++) {
        const draft = remaining[i]!;
        const reviewData = i === 0 && currentReview
          ? currentReview
          : await buildEntryProductReviewData(draft).catch(() => null);

        const product = productFromReviewData(reviewData);
        const price =
          draft.manualPrice > 0 ? draft.manualPrice : (product?.marketPrice ?? 0);

        await applyReviewToItem(draft.itemId, {
          originalUpc: draft.originalUpc ?? null,
          originalSku: draft.originalSku ?? null,
          quantity: draft.quantity,
          condition: draft.condition,
          notes: draft.description,
          customDescription: draft.description || null,
          pricingMode: draft.manualPrice > 0 ? 'manual' : 'market',
          percentBelow: 10,
          price,
          lookupStatus: lookupStatusFromReviewData(reviewData),
          product: product ?? undefined,
          workflowStatus: WORKFLOW_STATUS.Draft,
        });
      }
      return remaining.length;
    } finally {
      entrySavingRef.current = false;
      finishEntryQueue();
    }
  };

  /** Cancel without reviewing further. Deletes stubs only when none were advanced. */
  const handleCancelQueue = () => {
    const queue = entryQueueRef.current;
    const index = entryIndexRef.current;
    // Single-item cancel, or cancel before any confirm: remove untouched stubs from here on.
    for (let i = index; i < queue.length; i++) {
      const entry = queue[i];
      if (entry) removeItem(entry.itemId);
    }
    finishEntryQueue();
  };

  const entryBatchLabel =
    entryReviewActive && entryQueue.length > 1
      ? `Entry ${entryIndex + 1} of ${entryQueue.length}`
      : undefined;

  const entryBatchProgress =
    entryReviewActive && entryQueue.length > 1
      ? {
          current: entryIndex + 1,
          total: entryQueue.length,
          remaining: entryQueue.length - entryIndex - 1,
        }
      : undefined;

  const currentDraft = entryReviewActive ? entryQueue[entryIndex] ?? null : null;
  const remainingCount = entryReviewActive
    ? Math.max(0, entryQueue.length - entryIndex)
    : 0;

  return {
    entryReviewActive,
    entryReviewData,
    entryLookupLoading: entryLookupLoading || entryBootstrapping,
    entrySavingRemaining,
    entryBootstrapping,
    entryBatchLabel,
    entryBatchProgress,
    remainingCount,
    currentDraft,
    entryIndex,
    startEntryReview,
    handleConfirmEntry,
    handleSkipEntry,
    handleExitSaveRemaining,
    handleCancelQueue,
  };
}
