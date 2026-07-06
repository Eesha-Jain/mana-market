'use client';

interface BatchProgress {
  current: number;
  total: number;
  remaining?: number;
}

interface BatchProgressBannerProps {
  batchProgress: BatchProgress;
  /** Singular label, e.g. "Entry" or "Photo". */
  itemLabel: string;
  queuedItemCount?: number;
  onExitToReview?: () => void;
  onCancelBatch?: () => void;
}

export function BatchProgressBanner({
  batchProgress,
  itemLabel,
  queuedItemCount = 0,
  onExitToReview,
  onCancelBatch,
}: BatchProgressBannerProps) {
  if (batchProgress.total <= 1) return null;

  const remaining = batchProgress.remaining ?? batchProgress.total - batchProgress.current;

  return (
    <div
      className="photo-batch-progress-banner photo-batch-progress-banner--interactive"
      role="status"
      aria-live="polite"
    >
      <span className="photo-batch-progress-count">
        {itemLabel} {batchProgress.current} of {batchProgress.total}
      </span>
      {remaining > 0 ? (
        <span className="photo-batch-progress-remaining">
          {remaining} left after this one
        </span>
      ) : (
        <span className="photo-batch-progress-remaining">Last {itemLabel.toLowerCase()}</span>
      )}
      <div className="batch-exit-actions">
        {queuedItemCount > 0 && onExitToReview && (
          <button type="button" className="btn-link btn-sm" onClick={onExitToReview}>
            Review all →
          </button>
        )}
        {onCancelBatch && (
          <button type="button" className="btn-link btn-sm batch-exit-cancel" onClick={onCancelBatch}>
            Cancel upload
          </button>
        )}
      </div>
    </div>
  );
}
