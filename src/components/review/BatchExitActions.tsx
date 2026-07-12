'use client';

interface BatchExitActionsProps {
  className?: string;
  queuedItemCount?: number;
  onExitToReview?: () => void;
  onCancel?: () => void;
  exitLabel?: string;
  cancelLabel?: string;
  cancelVariant?: 'link' | 'ghost';
}

export function BatchExitActions({
  className = 'batch-exit-actions',
  queuedItemCount = 0,
  onExitToReview,
  onCancel,
  exitLabel,
  cancelLabel = 'Cancel upload',
  cancelVariant = 'link',
}: BatchExitActionsProps) {
  const showExit = queuedItemCount > 0 && onExitToReview;
  const showCancel = onCancel;

  if (!showExit && !showCancel) return null;

  const resolvedExitLabel =
    exitLabel ?? `Review all ${queuedItemCount} item${queuedItemCount !== 1 ? 's' : ''} →`;

  const cancelClassName =
    cancelVariant === 'ghost'
      ? 'btn-ghost btn-sm'
      : 'btn-link btn-sm batch-exit-cancel';

  return (
    <div className={className}>
      {showExit && (
        <button type="button" className="btn-link btn-sm" onClick={onExitToReview}>
          {resolvedExitLabel}
        </button>
      )}
      {showCancel && (
        <button type="button" className={cancelClassName} onClick={onCancel}>
          {cancelLabel}
        </button>
      )}
    </div>
  );
}
