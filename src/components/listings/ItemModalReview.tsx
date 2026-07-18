'use client';

import type { EbayCondition, Product } from '@/types';
import type { ProductReviewConfirmPayload, ProductReviewData } from '@/utils/review';
import { ProductMatchInsight } from '@/components/review/ProductMatchInsight';
import { SaveDefaultPrompt } from '@/components/ui/SaveDefaultPrompt';
import { useReviewDraft } from '@/hooks/useReviewDraft';
import type { BatchProgress } from './ItemModalShell';
import { ItemModalShell } from './ItemModalShell';
import { PhotoLabelAssignmentPanel } from './PhotoLabelAssignmentPanel';
import { BatchExitActions } from '@/components/review/BatchExitActions';
import {
  getMarketPriceOptionId,
  getMarketPriceOptions,
  optionDisplayLabel,
  resolveProductMarketSelection,
} from '@/utils/marketPrice';

export interface ItemModalReviewProps {
  mode: 'review';
  data: ProductReviewData;
  matchedProduct: Product | null;
  allAmbiguousResults?: Product[] | null;
  onRequestDisambiguation?: () => void;
  onConfirm: (payload: ProductReviewConfirmPayload, leaveAsDraft?: boolean) => void;
  onClose: () => void;
  /** When set (bulk), secondary Skip uses this instead of onClose. */
  onSkip?: () => void;
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
  onSkip,
  onExitToReview,
  queuedItemCount = 0,
  batchProgress,
  onApplyConditionToRemaining,
}: Omit<ItemModalReviewProps, 'mode'>) {
  const draft = useReviewDraft({ data, matchedProduct, onConfirm });

  const marketSelection = draft.activeProduct
    ? resolveProductMarketSelection(
        draft.activeProduct,
        draft.marketPricePreference,
        draft.selectedMarketPriceSource,
      )
    : null;
  const activeMarketOption = draft.activeProduct && marketSelection?.optionId
    ? getMarketPriceOptions(draft.activeProduct).find(
        o => getMarketPriceOptionId(o) === marketSelection.optionId,
      )
    : null;

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
        (data.missingImage || draft.imageSelection.selectedUrls.length === 0) && !data.scanError ? (
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
          <span className="text-muted-sm">Detected: {draft.detectedTitle}</span>
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
            marketPrice={draft.market}
            marketSourceLabel={
              activeMarketOption ? optionDisplayLabel(activeMarketOption) : undefined
            }
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
          <BatchExitActions
            className="photo-review-exit-bar"
            queuedItemCount={queuedItemCount}
            onExitToReview={onExitToReview}
          />
        ) : undefined
      }
      footerBefore={
        <button
          type="button"
          className="btn-link"
          onClick={() => draft.handleConfirmAsDraft()}
        >
          Continue but leave as draft
        </button>
      }
      secondaryLabel={batchProgress ? (draft.isPhoto ? 'Skip photo' : 'Skip entry') : 'Cancel'}
      onSecondary={onSkip ?? onClose}
      primaryLabel={
        batchProgress
          ? batchProgress.current < batchProgress.total
            ? draft.yourPrice && draft.yourPrice > 0
              ? 'Mark reviewed → next'
              : 'Save draft → next'
            : draft.yourPrice && draft.yourPrice > 0
              ? 'Mark reviewed'
              : 'Save as draft'
          : draft.yourPrice && draft.yourPrice > 0
            ? 'Mark as reviewed'
            : 'Save as draft'
      }
      onPrimary={() => draft.handleConfirm(false)}
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
