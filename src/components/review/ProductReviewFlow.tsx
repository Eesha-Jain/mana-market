'use client';

import { useEffect, useState } from 'react';
import type { Product, EbayCondition } from '@/types';
import { AmbiguousModal } from './AmbiguousModal';
import { ProductReviewModal } from './ProductReviewModal';
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

  useEffect(() => {
    setResolvedData(null);
    setShowDisambiguation(false);
  }, [data?.searchQuery, data?.variant, data?.photoUrl, data?.originalUpc, data?.originalSku]);

  const activeData = resolvedData ?? data;

  const showExitToReview = queuedItemCount > 0 && onExitToReview;
  const showCancelSingle = !batchProgress && onCancelBatch;
  const showLoadingExit = showExitToReview || showCancelSingle;

  if (loading) {
    return (
      <div className="modal-overlay modal-overlay--entry-review" role="status" aria-live="polite">
        <div className="modal modal--compact product-review-loading">
          <div className="spinner" />
          <p>{loadingMessage}</p>
          {showLoadingExit && (
            <div className="product-review-exit-actions">
              {showExitToReview && (
                <button type="button" className="btn-link btn-sm" onClick={onExitToReview}>
                  Review all {queuedItemCount} item{queuedItemCount !== 1 ? 's' : ''} →
                </button>
              )}
              {showCancelSingle && (
                <button type="button" className="btn-ghost btn-sm" onClick={onCancelBatch}>
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!activeData) return null;

  const disambiguationRequired = needsProductDisambiguation(activeData) || showDisambiguation;
  const ambiguousResults = activeData.ambiguousResults;

  if (disambiguationRequired && ambiguousResults?.length) {
    return (
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
    );
  }

  const matchedProduct = activeData.matchedProduct ?? activeData.suggestedProduct ?? null;

  return (
    <ProductReviewModal
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
  );
}
