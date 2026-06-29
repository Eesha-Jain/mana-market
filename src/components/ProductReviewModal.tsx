import { useMemo, useState, useEffect, useRef } from 'react';
import type { Product, EbayCondition, PricingMode, MarketPricePreference, MarketPriceSource } from '../types';
import {
  composeFromAssignments,
  suggestInitialLineAssignments,
  type OcrLineAssignment,
  type OcrLineTarget,
} from '../utils/photoScanner';
import {
  resolveInitialSelectedSource,
  resolveProductMarketPrice,
  resolveProductMarketSelection,
} from '../utils/marketPrice';
import { calculateDraftPrice } from '../utils/pricing';
import { ProductMatchInsight } from './ProductMatchInsight';
import {
  buildInitialSellerNotes,
  collectReviewImageCandidates,
  type ProductReviewConfirmPayload,
  type ProductReviewData,
} from '../utils/productReview';
import { LabeledFieldWithCase } from './CaseFormatToolbar';
import { ConditionQuantityFields } from './ConditionQuantityFields';
import { ListingPricingFields } from './ListingPricingFields';
import { MarketPriceSourceFields } from './MarketPriceSourceFields';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { resolveDefaultPricing } from '../utils/userSettings';
import { ProductImagePicker, type ProductImageSelection } from './ProductImagePicker';
import { SaveDefaultPrompt } from './SaveDefaultPrompt';
import type { TextCaseFormat } from '../utils/textCase';
import {
  applyReviewDefaultOffers,
  collectReviewDefaultOffers,
  keysFromReviewOffers,
} from '../utils/reviewDefaults';

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
  /** When set, user can explicitly copy the current condition to later batch items. */
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
  const { settings, applyDefaultTitleCase, applyDefaultDescriptionCase, saveConfiguredDefault } =
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
  const [pricingMode, setPricingMode] = useState<PricingMode>(pricingDefaults.pricingMode);
  const [percentBelow, setPercentBelow] = useState(pricingDefaults.percentBelow);
  const [manualPrice, setManualPrice] = useState(pricingDefaults.manualPrice);
  const [marketPricePreference, setMarketPricePreference] = useState<MarketPricePreference>(
    settings.defaultMarketPricePreference,
  );
  const [selectedMarketPriceSource, setSelectedMarketPriceSource] = useState<
    MarketPriceSource | undefined
  >(() => resolveInitialSelectedSource(activeProduct, settings.defaultMarketPricePreference));
  const [titleCaseUsed, setTitleCaseUsed] = useState<TextCaseFormat | null>(null);
  const [descriptionCaseUsed, setDescriptionCaseUsed] = useState<TextCaseFormat | null>(null);
  const [pendingConfirmPayload, setPendingConfirmPayload] = useState<ProductReviewConfirmPayload | null>(null);
  const [pendingDefaultOffers, setPendingDefaultOffers] = useState<ReturnType<typeof collectReviewDefaultOffers>>([]);
  const initialPricingRef = useRef(pricingDefaults);

  const reviewItemKey = `${data.variant}|${data.searchQuery}|${data.photoUrl ?? ''}|${data.originalUpc ?? ''}|${data.originalSku ?? ''}`;

  // Reset listing fields when advancing to the next batch item (avoid carrying condition forward).
  useEffect(() => {
    setCondition(data.initialCondition);
    setQuantity(data.initialQuantity);
  }, [reviewItemKey, data.initialCondition, data.initialQuantity]);

  useEffect(() => {
    setMarketPricePreference(settings.defaultMarketPricePreference);
    setSelectedMarketPriceSource(
      resolveInitialSelectedSource(activeProduct, settings.defaultMarketPricePreference),
    );
  }, [reviewItemKey, activeProduct, settings.defaultMarketPricePreference]);

  // Sync when the matched product / defaults change — not when label assignments update title.
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
      saveConfiguredDefault(patch, keysFromReviewOffers(pendingDefaultOffers));
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

  return (
    <div className={`modal-overlay modal-overlay--${isPhoto ? 'photo' : 'entry'}-review`} onClick={onClose}>
      <div
        className="modal modal--wide item-detail-modal photo-review-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header photo-review-header">
          <div className="photo-review-header-text">
            <div className="photo-review-title-row">
              <h2 className="modal-title">{modalTitle}</h2>
              {batchProgress && (
                <span className="photo-review-batch-badge">
                  {batchProgress.current}/{batchProgress.total}
                </span>
              )}
            </div>
            <p className="modal-subtitle photo-review-subtitle">{modalSubtitle}</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body item-detail-body photo-review-body">
          {(data.scanError || data.lookupError) && (
            <div className="form-error-banner photo-review-alert">
              {data.scanError || data.lookupError}
            </div>
          )}

          {(data.missingImage || !imageSelection.selectedUrl) && !data.scanError && (
            <div className="product-image-missing-banner">
              No image found online — upload your own or pick from matches below.
            </div>
          )}

          <ProductImagePicker
            candidates={imageCandidates}
            selection={imageSelection}
            onChange={setImageSelection}
            alt={isPhoto ? 'Product label' : activeProduct?.title ?? 'Product'}
          />

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

          <section className="photo-review-section photo-review-form">
            <h3 className="item-detail-section-title">Listing details</h3>

            <div className="item-detail-form">
              <LabeledFieldWithCase
                label={<>Listing title</>}
                required
                placeholder={detectedTitle || 'Product title…'}
                value={title}
                onChange={v => {
                  setTitle(v);
                  setTitleEditedManually(true);
                }}
                onFormatted={() => setTitleEditedManually(true)}
                onFormatSelect={setTitleCaseUsed}
                hint={
                  detectedTitle && title !== detectedTitle ? (
                    <span className="text-muted text-sm">Detected: {detectedTitle}</span>
                  ) : undefined
                }
              />

              <LabeledFieldWithCase
                label="Description"
                multiline
                rows={5}
                placeholder="Product description…"
                value={description}
                onChange={v => {
                  setDescription(v);
                  setDescriptionEditedManually(true);
                }}
                onFormatted={() => setDescriptionEditedManually(true)}
                onFormatSelect={setDescriptionCaseUsed}
              />

              <LabeledFieldWithCase
                label="Seller notes"
                multiline
                rows={3}
                placeholder="SKU, internal notes, or other seller-only details…"
                value={sellerNotes}
                onChange={setSellerNotes}
              />

              <ConditionQuantityFields
                condition={condition}
                quantity={quantity}
                onConditionChange={setCondition}
                onQuantityChange={setQuantity}
              />

              {batchProgress &&
                (batchProgress.remaining ?? 0) > 0 &&
                condition &&
                onApplyConditionToRemaining && (
                  <button
                    type="button"
                    className="btn-link btn-sm batch-apply-condition-btn"
                    onClick={() => onApplyConditionToRemaining(condition)}
                  >
                    Apply &ldquo;{condition}&rdquo; to remaining {batchProgress.remaining} item
                    {batchProgress.remaining !== 1 ? 's' : ''}
                  </button>
                )}

              {activeProduct && (
                <ProductMatchInsight
                  product={activeProduct}
                  onPickDifferent={
                    allAmbiguousResults && onRequestDisambiguation
                      ? onRequestDisambiguation
                      : undefined
                  }
                />
              )}

              <MarketPriceSourceFields
                product={activeProduct}
                preference={marketPricePreference}
                selectedSource={selectedMarketPriceSource}
                onPreferenceChange={setMarketPricePreference}
                onSelectedSourceChange={setSelectedMarketPriceSource}
              />

              <ListingPricingFields
                marketPrice={market}
                pricingMode={pricingMode}
                percentBelow={percentBelow}
                manualPrice={manualPrice}
                finalPrice={yourPrice}
                onPricingModeChange={setPricingMode}
                onPercentBelowChange={setPercentBelow}
                onManualPriceChange={setManualPrice}
              />
            </div>
          </section>
        </div>

        <div className="modal-footer photo-review-footer">
          {batchProgress && (
            <span className="photo-batch-footer-progress photo-batch-footer-progress--desktop">
              {isPhoto ? 'Photo' : 'Entry'} {batchProgress.current} of {batchProgress.total}
            </span>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>
            {batchProgress ? (isPhoto ? 'Skip photo' : 'Skip entry') : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleConfirm}
          >
            {batchProgress
              ? batchProgress.current < batchProgress.total
                ? 'Done → next'
                : 'Done'
              : 'Add to queue'}
          </button>
        </div>
        {(showExitToReview && !batchProgress) && (
          <div className="photo-review-exit-bar">
            <button type="button" className="btn-link btn-sm" onClick={onExitToReview}>
              Review all {queuedItemCount} item{queuedItemCount !== 1 ? 's' : ''} →
            </button>
          </div>
        )}
      </div>

      {pendingDefaultOffers.length > 0 && (
        <SaveDefaultPrompt
          offers={pendingDefaultOffers}
          onConfirm={handleSaveDefaultsConfirm}
          onDecline={handleSaveDefaultsDecline}
        />
      )}
    </div>
  );
}
