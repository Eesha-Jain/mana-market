'use client';

import type { ReactNode } from 'react';
import type {
  EbayCondition,
  ImageCandidate,
  PricingMode,
  Product,
  MarketPricePreference,
  MarketPriceSource,
} from '@/types';
import { EBAY_CONDITIONS } from '@/types';
import { LabeledFieldWithCase } from '@/components/ui/CaseFormatToolbar';
import { ListingPricingFields } from './ListingPricingFields';
import { MarketPriceSourceFields } from './MarketPriceSourceFields';
import {
  ProductImagePicker,
  type ProductImageSelection,
} from '@/components/review/ProductImagePicker';
import type { TextCaseFormat } from '@/utils/textCase';

export interface BatchProgress {
  current: number;
  total: number;
  remaining?: number;
}

interface ListingEditorModalUIProps {
  overlayClassName?: string;
  modalClassName?: string;
  layout?: 'stacked' | 'split';

  title: ReactNode;
  subtitle?: ReactNode;
  batchProgress?: BatchProgress;
  batchLabel?: string;
  onClose: () => void;

  imageMissingBanner?: ReactNode;
  imageCandidates: ImageCandidate[];
  imageSelection: ProductImageSelection;
  onImageChange: (selection: ProductImageSelection) => void;
  imageAlt: string;

  beforeBody?: ReactNode;
  mediaAside?: ReactNode;
  beforeForm?: ReactNode;
  afterForm?: ReactNode;

  formSectionTitle?: string;
  titleValue: string;
  onTitleChange: (value: string) => void;
  titlePlaceholder?: string;
  titleRequired?: boolean;
  titleHint?: ReactNode;
  onTitleFormatted?: () => void;
  onTitleFormatSelect?: (format: TextCaseFormat) => void;

  descriptionValue: string;
  onDescriptionChange: (value: string) => void;
  descriptionPlaceholder?: string;
  descriptionHint?: ReactNode;
  onDescriptionFormatted?: () => void;
  onDescriptionFormatSelect?: (format: TextCaseFormat) => void;

  sellerNotesValue?: string;
  onSellerNotesChange?: (value: string) => void;

  /** Override the default condition/quantity row (used by ItemDetailModal). */
  conditionQuantitySection?: ReactNode;

  condition?: EbayCondition | null;
  quantity?: number;
  onConditionChange?: (condition: EbayCondition | null) => void;
  onQuantityChange?: (quantity: number) => void;
  onApplyConditionToRemaining?: (condition: EbayCondition) => void;

  matchInsight?: ReactNode;

  product: Product | null | undefined;
  marketPricePreference: MarketPricePreference;
  selectedMarketPriceSource?: MarketPriceSource;
  onMarketPricePreferenceChange: (preference: MarketPricePreference) => void;
  onSelectedMarketPriceSourceChange: (source: MarketPriceSource | undefined) => void;

  marketPrice: number | null;
  pricingMode: PricingMode;
  percentBelow: number;
  manualPrice: number;
  finalPrice: number | null;
  onPricingModeChange: (mode: PricingMode) => void;
  onPercentBelowChange: (value: number) => void;
  onManualPriceChange: (value: number) => void;

  footerBefore?: ReactNode;
  footerAfter?: ReactNode;
  secondaryLabel: string;
  onSecondary: () => void;
  primaryLabel?: string;
  onPrimary?: () => void;
  afterModal?: ReactNode;
}

export function ListingEditorModalUI({
  overlayClassName = '',
  modalClassName = '',
  layout = 'stacked',
  title,
  subtitle,
  batchProgress,
  batchLabel = 'Entry',
  onClose,
  imageMissingBanner,
  imageCandidates,
  imageSelection,
  onImageChange,
  imageAlt,
  beforeBody,
  mediaAside,
  beforeForm,
  afterForm,
  formSectionTitle = 'Listing details',
  titleValue,
  onTitleChange,
  titlePlaceholder,
  titleRequired,
  titleHint,
  onTitleFormatted,
  onTitleFormatSelect,
  descriptionValue,
  onDescriptionChange,
  descriptionPlaceholder,
  descriptionHint,
  onDescriptionFormatted,
  onDescriptionFormatSelect,
  sellerNotesValue,
  onSellerNotesChange,
  conditionQuantitySection,
  condition = null,
  quantity = 1,
  onConditionChange,
  onQuantityChange,
  onApplyConditionToRemaining,
  matchInsight,
  product,
  marketPricePreference,
  selectedMarketPriceSource,
  onMarketPricePreferenceChange,
  onSelectedMarketPriceSourceChange,
  marketPrice,
  pricingMode,
  percentBelow,
  manualPrice,
  finalPrice,
  onPricingModeChange,
  onPercentBelowChange,
  onManualPriceChange,
  footerBefore,
  footerAfter,
  secondaryLabel,
  onSecondary,
  primaryLabel,
  onPrimary,
  afterModal,
}: ListingEditorModalUIProps) {
  const formFields = (
    <div className="item-detail-form">
      <LabeledFieldWithCase
        label="Listing title"
        required={titleRequired}
        placeholder={titlePlaceholder}
        value={titleValue}
        onChange={onTitleChange}
        onFormatted={onTitleFormatted}
        onFormatSelect={onTitleFormatSelect}
        hint={titleHint}
      />

      <LabeledFieldWithCase
        label={sellerNotesValue !== undefined ? 'Description' : 'Listing description'}
        multiline
        rows={5}
        placeholder={descriptionPlaceholder}
        value={descriptionValue}
        onChange={onDescriptionChange}
        onFormatted={onDescriptionFormatted}
        onFormatSelect={onDescriptionFormatSelect}
        hint={descriptionHint}
      />

      {sellerNotesValue !== undefined && onSellerNotesChange && (
        <LabeledFieldWithCase
          label="Seller notes"
          multiline
          rows={3}
          placeholder="SKU, internal notes, or other seller-only details…"
          value={sellerNotesValue}
          onChange={onSellerNotesChange}
        />
      )}

      {conditionQuantitySection ?? (
        <div className="photo-review-field-row">
          <label className="detail-field">
            <span>Condition <span className="required-mark">*</span></span>
            <select
              className="detail-input"
              value={condition ?? ''}
              onChange={e =>
                onConditionChange?.(
                  e.target.value ? (e.target.value as EbayCondition) : null,
                )
              }
            >
              <option value="">— Select condition —</option>
              {EBAY_CONDITIONS.map(c => (
                <option key={c.id} value={c.label} title={c.mtgEquivalent}>
                  {`${c.label} (${c.mtgEquivalent})`}
                </option>
              ))}
            </select>
          </label>

          <label className="detail-field">
            <span>Quantity</span>
            <input
              type="number"
              className="detail-input"
              min={1}
              max={999}
              value={quantity}
              onChange={e =>
                onQuantityChange?.(Math.max(1, parseInt(e.target.value, 10) || 1))
              }
            />
          </label>
        </div>
      )}

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

      {matchInsight}

      <MarketPriceSourceFields
        product={product}
        preference={marketPricePreference}
        selectedSource={selectedMarketPriceSource}
        onPreferenceChange={onMarketPricePreferenceChange}
        onSelectedSourceChange={onSelectedMarketPriceSourceChange}
      />

      <ListingPricingFields
        marketPrice={marketPrice}
        pricingMode={pricingMode}
        percentBelow={percentBelow}
        manualPrice={manualPrice}
        finalPrice={finalPrice}
        onPricingModeChange={onPricingModeChange}
        onPercentBelowChange={onPercentBelowChange}
        onManualPriceChange={onManualPriceChange}
      />

      {afterForm}
    </div>
  );

  const imageBlock = (
    <>
      {imageMissingBanner}
      <ProductImagePicker
        candidates={imageCandidates}
        selection={imageSelection}
        onChange={onImageChange}
        alt={imageAlt}
      />
      {mediaAside}
    </>
  );

  return (
    <div
      className={`modal-overlay${overlayClassName ? ` ${overlayClassName}` : ''}`}
      onClick={onClose}
    >
      <div
        className={`modal modal--wide item-detail-modal${modalClassName ? ` ${modalClassName}` : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header photo-review-header">
          <div className="photo-review-header-text">
            <div className="photo-review-title-row">
              <h2 className="modal-title">{title}</h2>
              {batchProgress && batchProgress.total > 1 && (
                <span className="photo-review-batch-badge">
                  {batchProgress.current}/{batchProgress.total}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="modal-subtitle photo-review-subtitle">{subtitle}</p>
            )}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body item-detail-body photo-review-body">
          {beforeBody}

          {layout === 'split' ? (
            <div className="item-detail-layout">
              <div className="item-detail-media">{imageBlock}</div>
              <div>
                <h3 className="item-detail-section-title">{formSectionTitle}</h3>
                {beforeForm}
                {formFields}
              </div>
            </div>
          ) : (
            <>
              {imageBlock}
              {beforeForm}
              <section className="photo-review-section photo-review-form">
                <h3 className="item-detail-section-title">{formSectionTitle}</h3>
                {formFields}
              </section>
            </>
          )}
        </div>

        <div className="modal-footer photo-review-footer">
          {footerBefore}
          {batchProgress && batchProgress.total > 1 && (
            <span className="photo-batch-footer-progress photo-batch-footer-progress--desktop">
              {batchLabel} {batchProgress.current} of {batchProgress.total}
            </span>
          )}
          <button type="button" className="btn-ghost" onClick={onSecondary}>
            {secondaryLabel}
          </button>
          {primaryLabel && onPrimary && (
            <button type="button" className="btn-primary" onClick={onPrimary}>
              {primaryLabel}
            </button>
          )}
        </div>

        {footerAfter}
      </div>

      {afterModal}
    </div>
  );
}
