'use client';

import { useEffect, useRef, useState } from 'react';
import type { Product, EbayCondition } from '@/types';
import { toastReviewMessage, useToast } from '@/contexts/ToastContext';
import { BatchProgressBanner } from './BatchProgressBanner';
import { BatchExitActions } from './BatchExitActions';
import { AmbiguousModal } from './AmbiguousModal';
import { ItemModal } from '@/components/listings/ItemModal';
import { Modal } from '@/components/ui/Modal';
import {
  needsProductDisambiguation,
  withSelectedProduct,
  type ProductReviewConfirmPayload,
  type ProductReviewData,
} from '@/utils/productReview';

interface ProductReviewFlowProps {
  data: ProductReviewData | null;
  loading?: boolean;
  loadingMessage?: string;
  onConfirm: (payload: ProductReviewConfirmPayload) => void;
  onClose: () => void;
  onExitToReview?: () => void;
  onCancelBatch?: () => void;
  queuedItemCount?: number;
  batchProgress?: { current: number; total: number; remaining?: number };
  onApplyConditionToRemaining?: (condition: EbayCondition) => void;
}

export function ProductReviewFlow({
  data,
  loading = false,
  loadingMessage = 'Looking up product…',
  onConfirm,
  onClose,
  onExitToReview,
  onCancelBatch,
  queuedItemCount = 0,
  batchProgress,
  onApplyConditionToRemaining,
}: ProductReviewFlowProps) {
  const [resolvedData, setResolvedData] = useState<ProductReviewData | null>(null);
  const [showDisambiguation, setShowDisambiguation] = useState(false);
  const toast = useToast();
  const lastReviewToastRef = useRef<string | null>(null);

  useEffect(() => {
    setResolvedData(null);
    setShowDisambiguation(false);
    lastReviewToastRef.current = null;
  }, [data?.searchQuery, data?.variant, data?.photoUrl, data?.originalUpc, data?.originalSku]);

  const activeData = resolvedData ?? data;

  useEffect(() => {
    const message = activeData?.scanError || activeData?.lookupError;
    if (!message || message === lastReviewToastRef.current) return;
    lastReviewToastRef.current = message;
    toastReviewMessage(toast, message);
  }, [activeData?.scanError, activeData?.lookupError, toast]);

  const showExitToReview = queuedItemCount > 0 && onExitToReview;
  const showCancelSingle = !batchProgress && onCancelBatch;
  const showLoadingExit = showExitToReview || showCancelSingle;
  const batchItemLabel = data?.variant === 'photo' ? 'Photo' : 'Entry';
  const batchBanner = batchProgress && batchProgress.total > 1 ? (
    <BatchProgressBanner
      batchProgress={batchProgress}
      itemLabel={batchItemLabel}
      queuedItemCount={queuedItemCount}
      onExitToReview={onExitToReview}
      onCancelBatch={onCancelBatch}
    />
  ) : null;

  if (loading) {
    return (
      <>
        {batchBanner}
        <Modal
          compact
          hideHeader
          hideClose
          bareBody
          closeOnOverlayClick={false}
          overlayClassName="modal-overlay--entry-review"
          overlayRole="status"
          overlayAriaLive="polite"
          className="product-review-loading"
          onClose={onClose}
        >
          <div className="spinner" />
          <p>{loadingMessage}</p>
          {showLoadingExit && (
            <BatchExitActions
              className="product-review-exit-actions"
              queuedItemCount={queuedItemCount}
              onExitToReview={showExitToReview ? onExitToReview : undefined}
              onCancel={showCancelSingle ? onCancelBatch : undefined}
              cancelLabel="Cancel"
              cancelVariant="ghost"
            />
          )}
        </Modal>
      </>
    );
  }

  if (!activeData) return batchBanner;

  const disambiguationRequired = needsProductDisambiguation(activeData) || showDisambiguation;
  const ambiguousResults = activeData.ambiguousResults;

  if (disambiguationRequired && ambiguousResults?.length) {
    return (
      <>
        {batchBanner}
        <AmbiguousModal
        query={activeData.searchQuery}
        results={ambiguousResults}
        onSelect={(product: Product) => {
          setResolvedData(withSelectedProduct(activeData, product));
          setShowDisambiguation(false);
        }}
        onClose={() => {
          if (needsProductDisambiguation(activeData)) {
            onClose();
            return;
          }
          setShowDisambiguation(false);
        }}
        />
      </>
    );
  }

  const matchedProduct = activeData.matchedProduct ?? activeData.suggestedProduct ?? null;

  return (
    <>
      {batchBanner}
      <ItemModal
      mode="review"
      key={`${activeData.variant}-${activeData.searchQuery}-${matchedProduct?.title ?? 'manual'}`}
      data={activeData}
      matchedProduct={matchedProduct}
      allAmbiguousResults={ambiguousResults}
      onRequestDisambiguation={
        ambiguousResults?.length
          ? () => setShowDisambiguation(true)
          : undefined
      }
      onConfirm={onConfirm}
      onClose={onClose}
      onExitToReview={onExitToReview}
      queuedItemCount={queuedItemCount}
      batchProgress={batchProgress}
      onApplyConditionToRemaining={onApplyConditionToRemaining}
    />
    </>
  );
}
