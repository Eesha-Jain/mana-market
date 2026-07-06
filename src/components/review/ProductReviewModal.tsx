'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import type { Product, EbayCondition } from '@/types';
import {
  composeFromAssignments,
  suggestInitialLineAssignments,
  type OcrLineAssignment,
  type OcrLineTarget,
} from '@/utils/photoScanner';
import {
  resolveInitialSelectedSource,
  resolveProductMarketPrice,
  resolveProductMarketSelection,
} from '@/utils/marketPrice';
import { calculateDraftPrice } from '@/utils/pricing';
import { ProductMatchInsight } from './ProductMatchInsight';
import {
  buildInitialSellerNotes,
  collectReviewImageCandidates,
  type ProductReviewConfirmPayload,
  type ProductReviewData,
} from '@/utils/productReview';
import { ListingEditorModalUI } from '@/components/listings/ListingEditorModalUI';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { resolveDefaultPricing, resolveMarketPricePreference } from '@/utils/userSettings';
import type { ProductImageSelection } from './ProductImagePicker';
import { SaveDefaultPrompt } from '@/components/ui/SaveDefaultPrompt';
import type { TextCaseFormat } from '@/utils/textCase';
import {
  applyReviewDefaultOffers,
  collectReviewDefaultOffers,
} from '@/utils/reviewDefaults';

interface ProductReviewModalProps {
  data: ProductReviewData;
  matchedProduct: Product | null;
  allAmbiguousResults?: Product[] | null;
  onRequestDisambiguation?: () => void;
  onConfirm: (payload: ProductReviewConfirmPayload) => void;
  onClose: () => void;
  onExitToReview?: () => void;
  queuedItemCount?: number;
  batchProgress?: { current: number; total: number; remaining?: number };
  onApplyConditionToRemaining?: (condition: EbayCondition) => void;
}

export function ProductReviewModal({
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
}: ProductReviewModalProps) {
  const { settings, applyDefaultTitleCase, applyDefaultDescriptionCase, updateSettings } =
    useUserSettings();
  const isPhoto = data.variant === 'photo';
  const activeProduct = matchedProduct ?? data.suggestedProduct ?? null;
  const pricingDefaults = resolveDefaultPricing(settings, {
    manualPrice: data.initialManualPrice,
    pricingMode: data.initialPricingMode,
    percentBelow: data.initialPercentBelow,
  });

  const detectedTitle =
    data.parseResult?.fullTitle ??
    data.searchQuery ??
    activeProduct?.title ??
    '';

  const initialAssignments = useMemo(
    () => suggestInitialLineAssignments(data.readableLines, data.parseResult ?? null),
    [data.readableLines, data.parseResult],
  );
  const initialComposed = useMemo(
    () => composeFromAssignments(initialAssignments),
    [initialAssignments],
  );

  const defaultTitle = isPhoto
    ? (initialComposed.title || activeProduct?.title || data.searchQuery || detectedTitle)
    : (activeProduct?.title ?? initialComposed.title ?? data.searchQuery ?? detectedTitle);

  const defaultDescription = isPhoto
    ? (initialComposed.description || activeProduct?.description || '')
    : (activeProduct?.description ?? initialComposed.description ?? '');

  const defaultSellerNotes = buildInitialSellerNotes(
    data.originalUpc,
    data.originalSku,
    data.importNotes,
  );

  const [lineAssignments, setLineAssignments] = useState<OcrLineAssignment[]>(initialAssignments);
  const [title, setTitle] = useState(() => applyDefaultTitleCase(defaultTitle));
  const [description, setDescription] = useState(() =>
    applyDefaultDescriptionCase(defaultDescription),
  );
  const [sellerNotes, setSellerNotes] = useState(() =>
    applyDefaultDescriptionCase(defaultSellerNotes),
  );
  const [titleEditedManually, setTitleEditedManually] = useState(false);
  const [descriptionEditedManually, setDescriptionEditedManually] = useState(false);
  const [quantity, setQuantity] = useState(data.initialQuantity);
  const [condition, setCondition] = useState<EbayCondition | null>(data.initialCondition);
  const [pricingMode, setPricingMode] = useState(pricingDefaults.pricingMode);
  const [percentBelow, setPercentBelow] = useState(pricingDefaults.percentBelow);
  const [manualPrice, setManualPrice] = useState(pricingDefaults.manualPrice);
  const resolvedMarketPricePreference = resolveMarketPricePreference(settings);
  const [marketPricePreference, setMarketPricePreference] = useState(
    resolvedMarketPricePreference,
  );
  const [selectedMarketPriceSource, setSelectedMarketPriceSource] = useState(
    () => resolveInitialSelectedSource(activeProduct, resolvedMarketPricePreference),
  );
  const [titleCaseUsed, setTitleCaseUsed] = useState<TextCaseFormat | null>(null);
  const [descriptionCaseUsed, setDescriptionCaseUsed] = useState<TextCaseFormat | null>(null);
  const [pendingConfirmPayload, setPendingConfirmPayload] = useState<ProductReviewConfirmPayload | null>(null);
  const [pendingDefaultOffers, setPendingDefaultOffers] = useState<ReturnType<typeof collectReviewDefaultOffers>>([]);
  const initialPricingRef = useRef(pricingDefaults);

  const reviewItemKey = `${data.variant}|${data.searchQuery}|${data.photoUrl ?? ''}|${data.originalUpc ?? ''}|${data.originalSku ?? ''}`;

  useEffect(() => {
    setCondition(data.initialCondition);
    setQuantity(data.initialQuantity);
  }, [reviewItemKey, data.initialCondition, data.initialQuantity]);

  useEffect(() => {
    const preference = resolveMarketPricePreference(settings);
    setMarketPricePreference(preference);
    setSelectedMarketPriceSource(resolveInitialSelectedSource(activeProduct, preference));
  }, [reviewItemKey, activeProduct, settings]);

  useEffect(() => {
    if (titleEditedManually) return;
    const nextTitle = applyDefaultTitleCase(defaultTitle);
    if (nextTitle.trim()) {
      setTitle(nextTitle);
    }
  }, [defaultTitle, titleEditedManually, applyDefaultTitleCase]);

  const initialImageCandidates = useMemo(
    () => collectReviewImageCandidates(data, activeProduct),
    [data, activeProduct],
  );
  const initialSelectedUrl =
    data.variant === 'photo' && data.photoUrl
      ? data.photoUrl
      : activeProduct?.imageUrls[0] ?? initialImageCandidates[0]?.url ?? null;

  const [imageSelection, setImageSelection] = useState<ProductImageSelection>(() => ({
    selectedUrl: initialSelectedUrl,
    userImageUrl: undefined,
    preferredImageSource:
      data.variant === 'photo' && data.photoUrl ? 'user' : 'catalog',
  }));

  const imageCandidates = useMemo(
    () => collectReviewImageCandidates(data, activeProduct, imageSelection.userImageUrl),
    [data, activeProduct, imageSelection.userImageUrl],
  );

  const market = activeProduct
    ? resolveProductMarketPrice(activeProduct, marketPricePreference, selectedMarketPriceSource)
    : null;
  const yourPrice = calculateDraftPrice(market, {
    pricingMode,
    percentBelow,
    manualPrice,
  });

  const applyAssignments = (
    assignments: OcrLineAssignment[],
    options: { fromLinePicker?: boolean } = {},
  ) => {
    setLineAssignments(assignments);
    const composed = composeFromAssignments(assignments);
    const syncFromLines = options.fromLinePicker || !titleEditedManually;
    const syncDescFromLines = options.fromLinePicker || !descriptionEditedManually;
    if (syncFromLines) {
      setTitle(applyDefaultTitleCase(composed.title));
    }
    if (syncDescFromLines) {
      setDescription(applyDefaultDescriptionCase(composed.description));
    }
  };

  const setLineTarget = (line: string, target: OcrLineTarget) => {
    setTitleEditedManually(false);
    setDescriptionEditedManually(false);
    applyAssignments(
      lineAssignments.map(a => (a.line === line ? { line, target } : a)),
      { fromLinePicker: true },
    );
  };

  const moveLine = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= lineAssignments.length) return;
    const next = [...lineAssignments];
    [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
    setTitleEditedManually(false);
    setDescriptionEditedManually(false);
    applyAssignments(next, { fromLinePicker: true });
  };

  const handleConfirm = () => {
    const trimmedTitle = title.trim() || data.searchQuery.trim() || detectedTitle.trim();
    if (!trimmedTitle) return;

    const trimmedDescription = description.trim();
    const trimmedNotes = sellerNotes.trim();
    const selectedImageUrl = imageSelection.selectedUrl;
    const imageUrls = selectedImageUrl
      ? [
          selectedImageUrl,
          ...(activeProduct?.imageUrls.filter(url => url !== selectedImageUrl) ?? []),
        ]
      : activeProduct?.imageUrls ?? [];

    const priceSelection = activeProduct
      ? resolveProductMarketSelection(activeProduct, marketPricePreference, selectedMarketPriceSource)
      : { price: null, source: null };

    const product = activeProduct
      ? {
          ...activeProduct,
          title: detectedTitle || activeProduct.title,
          description: trimmedDescription || activeProduct.description,
          imageUrls,
          marketPrice: priceSelection.price ?? activeProduct.marketPrice,
          marketPriceSource: priceSelection.source ?? activeProduct.marketPriceSource,
        }
      : trimmedDescription || selectedImageUrl
        ? {
            title: trimmedTitle,
            description: trimmedDescription,
            imageUrls: selectedImageUrl ? [selectedImageUrl] : [],
          }
        : undefined;

    const payload: ProductReviewConfirmPayload = {
      query: trimmedTitle,
      source: data.source,
      customTitle: trimmedTitle,
      customDescription: trimmedDescription || undefined,
      notes: trimmedNotes,
      originalUpc: data.originalUpc,
      originalSku: data.originalSku,
      quantity,
      condition,
      pricingMode,
      percentBelow,
      manualPrice,
      marketPricePreference,
      selectedMarketPriceSource: selectedMarketPriceSource ?? priceSelection.source ?? undefined,
      product,
      photoUrl: data.photoUrl,
      userImageUrl: imageSelection.userImageUrl,
      preferredImageSource: imageSelection.preferredImageSource,
      selectedImageUrl: selectedImageUrl ?? undefined,
      parseMeta: data.parseResult
        ? {
            packType: data.parseResult.packType ?? undefined,
            cardCount: data.parseResult.cardCount ?? undefined,
          }
        : undefined,
    };

    const offers = collectReviewDefaultOffers(
      settings,
      {
        titleCase: titleCaseUsed ?? undefined,
        descriptionCase: descriptionCaseUsed ?? undefined,
        pricingMode,
        percentBelow,
      },
      initialPricingRef.current,
    );

    if (offers.length) {
      setPendingConfirmPayload(payload);
      setPendingDefaultOffers(offers);
      return;
    }

    onConfirm(payload);
  };

  const finishConfirm = (payload: ProductReviewConfirmPayload) => {
    setPendingConfirmPayload(null);
    setPendingDefaultOffers([]);
    onConfirm(payload);
  };

  const handleSaveDefaultsConfirm = () => {
    if (pendingConfirmPayload) {
      const patch = applyReviewDefaultOffers(
        {
          titleCase: titleCaseUsed ?? undefined,
          descriptionCase: descriptionCaseUsed ?? undefined,
          pricingMode,
          percentBelow,
        },
        pendingDefaultOffers,
      );
      updateSettings(patch);
      finishConfirm(pendingConfirmPayload);
    }
  };

  const handleSaveDefaultsDecline = () => {
    if (pendingConfirmPayload) {
      finishConfirm(pendingConfirmPayload);
    }
  };

  const modalTitle = isPhoto ? 'Review photo scan' : 'Review entry';
  const modalSubtitle = batchProgress
    ? isPhoto
      ? 'Assign label lines, then confirm listing details.'
      : 'Confirm listing details, then add to the queue.'
    : isPhoto
      ? 'Pick label text for title & description, then set listing options.'
      : 'Product details are prefilled from lookup — edit before adding to the queue.';

  const showExitToReview = queuedItemCount > 0 && onExitToReview;

  const beforeForm = (
    <>
      {data.parseResult && (
        <div className="product-review-detected-banner">
          <span className="product-review-detected-label">Detected from label</span>
          <p className="product-review-detected-title">{data.parseResult.fullTitle}</p>
          <div className="photo-insight-chips">
            {data.parseResult.packType && (
              <span className="badge badge--gray">{data.parseResult.packType}</span>
            )}
            {data.parseResult.cardCount && (
              <span className="badge badge--gray">{data.parseResult.cardCount}</span>
            )}
          </div>
          <button
            type="button"
            className="btn-link btn-sm"
            onClick={() => {
              setTitleEditedManually(false);
              setDescriptionEditedManually(false);
              applyAssignments(initialAssignments, { fromLinePicker: true });
              if (data.parseResult?.fullTitle) {
                setTitle(applyDefaultTitleCase(data.parseResult.fullTitle));
              }
            }}
          >
            Reset label assignments
          </button>
        </div>
      )}

      {data.readableLines.length > 0 && (
        <section className="photo-review-section photo-review-labels">
          <div className="photo-review-section-head">
            <div>
              <h3 className="item-detail-section-title">Label text</h3>
              <p className="photo-labels-hint">
                Tap a destination for each line. Reorder with the arrows.
              </p>
            </div>
            <div className="photo-labels-legend" aria-hidden="true">
              <span className="photo-labels-legend-item photo-labels-legend-item--title">Title</span>
              <span className="photo-labels-legend-item photo-labels-legend-item--desc">Description</span>
              <span className="photo-labels-legend-item photo-labels-legend-item--skip">Skip</span>
            </div>
          </div>
          <div className="photo-line-target-list">
            {lineAssignments.map(({ line, target }, index) => (
              <div
                key={`${index}-${line}`}
                className={`photo-line-target-row photo-line-target-row--${target}`}
              >
                <span className="photo-line-index">{index + 1}</span>
                <div className="photo-line-target-main">
                  <div className="photo-line-reorder">
                    <button
                      type="button"
                      className="photo-line-reorder-btn"
                      disabled={index === 0}
                      onClick={() => moveLine(index, -1)}
                      aria-label={`Move "${line}" up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="photo-line-reorder-btn"
                      disabled={index === lineAssignments.length - 1}
                      onClick={() => moveLine(index, 1)}
                      aria-label={`Move "${line}" down`}
                    >
                      ↓
                    </button>
                  </div>
                  <span className="photo-line-target-text">{line}</span>
                </div>
                <div
                  className="photo-line-target-options photo-line-segment"
                  role="group"
                  aria-label={`Assign "${line}"`}
                >
                  {(['none', 'title', 'description'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      className={`photo-line-target-btn${target === option ? ' photo-line-target-btn--active' : ''}`}
                      onClick={() => setLineTarget(line, option)}
                    >
                      {option === 'none' ? 'Skip' : option === 'title' ? 'Title' : 'Description'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );

  return (
    <ListingEditorModalUI
      overlayClassName={isPhoto ? 'modal-overlay--photo-review' : 'modal-overlay--entry-review'}
      modalClassName="photo-review-modal"
      title={modalTitle}
      subtitle={modalSubtitle}
      batchProgress={batchProgress}
      batchLabel={isPhoto ? 'Photo' : 'Entry'}
      onClose={onClose}
      imageMissingBanner={
        (data.missingImage || !imageSelection.selectedUrl) && !data.scanError ? (
          <div className="product-image-missing-banner">
            No image found online — upload your own or pick from matches below.
          </div>
        ) : undefined
      }
      imageCandidates={imageCandidates}
      imageSelection={imageSelection}
      onImageChange={setImageSelection}
      imageAlt={isPhoto ? 'Product label' : activeProduct?.title ?? 'Product'}
      beforeForm={beforeForm}
      titleValue={title}
      onTitleChange={v => {
        setTitle(v);
        setTitleEditedManually(true);
      }}
      titlePlaceholder={detectedTitle || 'Product title…'}
      titleRequired
      titleHint={
        detectedTitle && title !== detectedTitle ? (
          <span className="text-muted text-sm">Detected: {detectedTitle}</span>
        ) : undefined
      }
      onTitleFormatted={() => setTitleEditedManually(true)}
      onTitleFormatSelect={setTitleCaseUsed}
      descriptionValue={description}
      onDescriptionChange={v => {
        setDescription(v);
        setDescriptionEditedManually(true);
      }}
      descriptionPlaceholder="Product description…"
      onDescriptionFormatted={() => setDescriptionEditedManually(true)}
      onDescriptionFormatSelect={setDescriptionCaseUsed}
      sellerNotesValue={sellerNotes}
      onSellerNotesChange={setSellerNotes}
      condition={condition}
      quantity={quantity}
      onConditionChange={setCondition}
      onQuantityChange={setQuantity}
      onApplyConditionToRemaining={onApplyConditionToRemaining}
      matchInsight={
        activeProduct ? (
          <ProductMatchInsight
            product={activeProduct}
            onPickDifferent={
              allAmbiguousResults && onRequestDisambiguation
                ? onRequestDisambiguation
                : undefined
            }
          />
        ) : undefined
      }
      product={activeProduct}
      marketPricePreference={marketPricePreference}
      selectedMarketPriceSource={selectedMarketPriceSource}
      onMarketPricePreferenceChange={setMarketPricePreference}
      onSelectedMarketPriceSourceChange={setSelectedMarketPriceSource}
      marketPrice={market}
      pricingMode={pricingMode}
      percentBelow={percentBelow}
      manualPrice={manualPrice}
      finalPrice={yourPrice}
      onPricingModeChange={setPricingMode}
      onPercentBelowChange={setPercentBelow}
      onManualPriceChange={setManualPrice}
      footerAfter={
        showExitToReview && !batchProgress ? (
          <div className="photo-review-exit-bar">
            <button type="button" className="btn-link btn-sm" onClick={onExitToReview}>
              Review all {queuedItemCount} item{queuedItemCount !== 1 ? 's' : ''} →
            </button>
          </div>
        ) : undefined
      }
      secondaryLabel={batchProgress ? (isPhoto ? 'Skip photo' : 'Skip entry') : 'Cancel'}
      onSecondary={onClose}
      primaryLabel={
        batchProgress
          ? batchProgress.current < batchProgress.total
            ? 'Done → next'
            : 'Done'
          : 'Add to queue'
      }
      onPrimary={handleConfirm}
      afterModal={
        pendingDefaultOffers.length > 0 ? (
          <SaveDefaultPrompt
            offers={pendingDefaultOffers}
            onConfirm={handleSaveDefaultsConfirm}
            onDecline={handleSaveDefaultsDecline}
          />
        ) : undefined
      }
    />
  );
}
