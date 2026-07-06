'use client';

import type { EbayCondition, Product } from '@/types';
import type { ProductReviewConfirmPayload, ProductReviewData } from '@/utils/productReview';
import { ProductMatchInsight } from '@/components/review/ProductMatchInsight';
import { SaveDefaultPrompt } from '@/components/ui/SaveDefaultPrompt';
import { useReviewDraft } from '@/hooks/useReviewDraft';
import type { BatchProgress } from './ItemModalShell';
import { ItemModalShell } from './ItemModalShell';
import { PhotoLabelAssignmentPanel } from './PhotoLabelAssignmentPanel';

export interface ItemModalReviewProps {
  mode: 'review';
  data: ProductReviewData;
  matchedProduct: Product | null;
  allAmbiguousResults?: Product[] | null;
  onRequestDisambiguation?: () => void;
  onConfirm: (payload: ProductReviewConfirmPayload) => void;
  onClose: () => void;
  onExitToReview?: () => void;
  queuedItemCount?: number;
  batchProgress?: BatchProgress;
  onApplyConditionToRemaining?: (condition: EbayCondition) => void;
}

export function ItemModalReview({
  data,
  matchedProduct,
  allAmbiguousResults,
  onRequestDisambiguation,
  onConfirm,
  onClose,
  onExitToReview,
  queuedItemCount = 0,
  batchProgress,
  onApplyConditionToRemaining,
}: Omit<ItemModalReviewProps, 'mode'>) {
  const draft = useReviewDraft({ data, matchedProduct, onConfirm });

  const modalTitle = draft.isPhoto ? 'Review photo scan' : 'Review entry';
  const modalSubtitle = batchProgress
    ? draft.isPhoto
      ? 'Assign label lines, then confirm listing details.'
      : 'Confirm listing details, then add to the queue.'
    : draft.isPhoto
      ? 'Pick label text for title & description, then set listing options.'
      : 'Product details are prefilled from lookup — edit before adding to the queue.';

  const showExitToReview = queuedItemCount > 0 && onExitToReview;

  return (
    <ItemModalShell
      overlayClassName={draft.isPhoto ? 'modal-overlay--photo-review' : 'modal-overlay--entry-review'}
      modalClassName="photo-review-modal"
      title={modalTitle}
      subtitle={modalSubtitle}
      batchProgress={batchProgress}
      batchLabel={draft.isPhoto ? 'Photo' : 'Entry'}
      onClose={onClose}
      imageMissingBanner={
        (data.missingImage || !draft.imageSelection.selectedUrl) && !data.scanError ? (
          <div className="product-image-missing-banner">
            No image found online — upload your own or pick from matches below.
          </div>
        ) : undefined
      }
      imageCandidates={draft.imageCandidates}
      imageSelection={draft.imageSelection}
      onImageChange={draft.setImageSelection}
      imageAlt={draft.isPhoto ? 'Product label' : draft.activeProduct?.title ?? 'Product'}
      beforeForm={
        <PhotoLabelAssignmentPanel
          data={data}
          lineAssignments={draft.lineAssignments}
          onSetLineTarget={draft.setLineTarget}
          onMoveLine={draft.moveLine}
          onResetAssignments={draft.resetLabelAssignments}
        />
      }
      titleValue={draft.title}
      onTitleChange={v => {
        draft.setTitle(v);
        draft.setTitleEditedManually(true);
      }}
      titlePlaceholder={draft.detectedTitle || 'Product title…'}
      titleRequired
      titleHint={
        draft.detectedTitle && draft.title !== draft.detectedTitle ? (
          <span className="text-muted text-sm">Detected: {draft.detectedTitle}</span>
        ) : undefined
      }
      onTitleFormatted={() => draft.setTitleEditedManually(true)}
      onTitleFormatSelect={draft.setTitleCaseUsed}
      descriptionValue={draft.description}
      onDescriptionChange={v => {
        draft.setDescription(v);
        draft.setDescriptionEditedManually(true);
      }}
      descriptionPlaceholder="Product description…"
      onDescriptionFormatted={() => draft.setDescriptionEditedManually(true)}
      onDescriptionFormatSelect={draft.setDescriptionCaseUsed}
      condition={draft.condition}
      quantity={draft.quantity}
      onConditionChange={draft.setCondition}
      onQuantityChange={draft.setQuantity}
      onApplyConditionToRemaining={onApplyConditionToRemaining}
      matchInsight={
        draft.activeProduct ? (
          <ProductMatchInsight
            product={draft.activeProduct}
            onPickDifferent={
              allAmbiguousResults && onRequestDisambiguation
                ? onRequestDisambiguation
                : undefined
            }
          />
        ) : undefined
      }
      product={draft.activeProduct}
      marketPricePreference={draft.marketPricePreference}
      selectedMarketPriceSource={draft.selectedMarketPriceSource}
      onMarketPricePreferenceChange={draft.setMarketPricePreference}
      onSelectedMarketPriceSourceChange={draft.setSelectedMarketPriceSource}
      marketPrice={draft.market}
      pricingMode={draft.pricingMode}
      percentBelow={draft.percentBelow}
      manualPrice={draft.manualPrice}
      finalPrice={draft.yourPrice}
      onPricingModeChange={draft.setPricingMode}
      onPercentBelowChange={draft.setPercentBelow}
      onManualPriceChange={draft.setManualPrice}
      footerAfter={
        showExitToReview && !batchProgress ? (
          <div className="photo-review-exit-bar">
            <button type="button" className="btn-link btn-sm" onClick={onExitToReview}>
              Review all {queuedItemCount} item{queuedItemCount !== 1 ? 's' : ''} →
            </button>
          </div>
        ) : undefined
      }
      secondaryLabel={batchProgress ? (draft.isPhoto ? 'Skip photo' : 'Skip entry') : 'Cancel'}
      onSecondary={onClose}
      primaryLabel={
        batchProgress
          ? batchProgress.current < batchProgress.total
            ? 'Done → next'
            : 'Done'
          : 'Add to queue'
      }
      onPrimary={draft.handleConfirm}
      afterModal={
        draft.pendingDefaultOffers.length > 0 ? (
          <SaveDefaultPrompt
            offers={draft.pendingDefaultOffers}
            onConfirm={draft.handleSaveDefaultsConfirm}
            onDecline={draft.handleSaveDefaultsDecline}
          />
        ) : undefined
      }
    />
  );
}
