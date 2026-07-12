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
import { Modal } from '@/components/ui/Modal';
import { LabeledFieldWithCase } from '@/components/ui/CaseFormatToolbar';
import {
  ProductImagePicker,
  type ProductImageSelection,
} from '@/components/review/ProductImagePicker';
import type { TextCaseFormat } from '@/utils/textCase';
import { ConditionQuantityFields } from './ConditionQuantityFields';
import { ListingPricingFields } from './ListingPricingFields';
import { MarketPriceSourceFields } from './MarketPriceSourceFields';

export interface BatchProgress {
  current: number;
  total: number;
  remaining?: number;
}

export interface ItemModalShellProps {
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
  readOnly?: boolean;

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

  listedToggle?: {
    checked: boolean;
    onChange: (checked: boolean) => void;
  };

  onDelete?: () => void;

  footerBefore?: ReactNode;
  footerAfter?: ReactNode;
  secondaryLabel: string;
  onSecondary: () => void;
  primaryLabel?: string;
  onPrimary?: () => void;
  afterModal?: ReactNode;
}

export function ItemModalShell({
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
  readOnly = false,
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
  listedToggle,
  onDelete,
  footerBefore,
  footerAfter,
  secondaryLabel,
  onSecondary,
  primaryLabel,
  onPrimary,
  afterModal,
}: ItemModalShellProps) {
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
        readOnly={readOnly}
      />

      <LabeledFieldWithCase
        label="Description"
        multiline
        rows={5}
        placeholder={descriptionPlaceholder}
        value={descriptionValue}
        onChange={onDescriptionChange}
        onFormatted={onDescriptionFormatted}
        onFormatSelect={onDescriptionFormatSelect}
        hint={descriptionHint}
        readOnly={readOnly}
      />

      {conditionQuantitySection ?? (
        onConditionChange &&
        onQuantityChange && (
          <ConditionQuantityFields
            condition={condition}
            quantity={quantity}
            onConditionChange={onConditionChange}
            onQuantityChange={onQuantityChange}
            readOnly={readOnly}
          />
        )
      )}

      {batchProgress &&
        !readOnly &&
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
        readOnly={readOnly}
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
        readOnly={readOnly}
      />

      {listedToggle && (
        <label className="detail-field listing-listed-toggle">
          <span className="listing-listed-toggle-label">
            <input
              type="checkbox"
              checked={listedToggle.checked}
              onChange={e => listedToggle.onChange(e.target.checked)}
            />
            Listed on eBay?
          </span>
          <span className="text-muted-sm">
            {listedToggle.checked
              ? 'This listing is treated as live on eBay. Uncheck to edit details again.'
              : 'Check when the item is live on eBay (including if you listed it outside this app).'}
          </span>
        </label>
      )}

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
        readOnly={readOnly}
      />
      {mediaAside}
    </>
  );

  const bodyContent = (
    <>
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
    </>
  );

  const footerContent = (
    <>
      {footerBefore}
      {onDelete && (
        <button type="button" className="btn-danger btn-ghost" onClick={onDelete}>
          Delete
        </button>
      )}
      <div className="modal-footer-actions">
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
    </>
  );

  return (
    <Modal
      wide
      overlayClassName={overlayClassName}
      className={`item-detail-modal${modalClassName ? ` ${modalClassName}` : ''}`}
      headerClassName="photo-review-header"
      headerInnerClassName="photo-review-header-text"
      subtitleClassName="photo-review-subtitle"
      title={title}
      subtitle={subtitle}
      titleExtra={
        batchProgress && batchProgress.total > 1 ? (
          <span className="photo-review-batch-badge">
            {batchProgress.current}/{batchProgress.total}
          </span>
        ) : undefined
      }
      bodyClassName="item-detail-body photo-review-body"
      footerClassName="photo-review-footer"
      footer={footerContent}
      footerAfter={footerAfter}
      afterPanel={afterModal}
      onClose={onClose}
    >
      {bodyContent}
    </Modal>
  );
}
