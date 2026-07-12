'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EbayCondition, ItemListing, ItemSource } from '@/types';
import type { EntryReviewDraft } from '@/utils/entryReview';
import {
  buildEntryProductReviewData,
  type ProductReviewConfirmPayload,
  type ProductReviewData,
} from '@/utils/productReview';
import { statusFromProductMatch } from '@/utils/itemStatus';

interface UseEntryReviewQueueOptions {
  addItem: (query: string, source?: ItemSource, overrides?: Partial<ItemListing>) => ItemListing;
}

export function useEntryReviewQueue({ addItem }: UseEntryReviewQueueOptions) {
  const router = useRouter();

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
      photoUrl: payload.photoUrl,
      userImageUrl: payload.userImageUrl,
      preferredImageSource: payload.preferredImageSource,
      status: statusFromProductMatch(!!payload.product),
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
    router.push('/review');
  };

  const handleCancelEntryBatch = () => {
    finishEntryQueue();
  };

  const entryBatchProgress = entryReviewActive && entryQueue.length > 1
    ? {
        current: entryIndex + 1,
        total: entryQueue.length,
        remaining: entryQueue.length - entryIndex - 1,
      }
    : undefined;

  const currentDraft = entryReviewActive ? entryQueue[entryIndex] : null;

  return {
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
  };
}
