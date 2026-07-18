'use client';

import type { Product } from '@/types';
import { ITEM_CONDITIONS } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { ProductImagePicker } from '@/components/review/ProductImagePicker';
import { useEntryReviewDraft } from '@/hooks/useEntryReviewDraft';
import type { ProductReviewConfirmPayload, ProductReviewData } from '@/utils/review';
import { formatPrice } from '@/utils/search';

interface EntryReviewModalProps {
  data: ProductReviewData;
  matchedProduct: Product | null;
  onConfirm: (payload: ProductReviewConfirmPayload) => void;
  onClose: () => void;
  onRequestDisambiguation?: () => void;
  batchLabel?: string;
}

export function EntryReviewModal({
  data,
  matchedProduct,
  onConfirm,
  onClose,
  onRequestDisambiguation,
  batchLabel,
}: EntryReviewModalProps) {
  const draft = useEntryReviewDraft({ data, matchedProduct });

  const title = data.variant === 'photo' ? 'Review photo scan' : 'Review entry';
  const subtitle = batchLabel
    ?? (data.variant === 'photo'
      ? 'Confirm product details before adding to your draft queue.'
      : 'Edit listing details, then add to your draft queue.');

  const handleConfirm = () => {
    const payload = draft.buildConfirmPayload();
    if (payload) onConfirm(payload);
  };

  return (
    <Modal
      wide
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      overlayClassName={data.variant === 'photo' ? 'modal-overlay--photo-review' : 'modal-overlay--entry-review'}
      className="entry-review-modal"
    >
      <div className="entry-review-form">
        {draft.activeProduct && (
          <div className="entry-review-match">
            <p className="text-muted-sm">
              Matched: <strong>{draft.activeProduct.title}</strong>
              {draft.activeProduct.brand && ` · ${draft.activeProduct.brand}`}
              {draft.marketPrice != null && ` · ${formatPrice(draft.marketPrice)}`}
            </p>
            {onRequestDisambiguation && (
              <button type="button" className="btn-link btn-sm" onClick={onRequestDisambiguation}>
                Pick a different product
              </button>
            )}
          </div>
        )}

        {(data.missingImage || draft.selectedImageUrls.length === 0) && !data.scanError && (
          <p className="product-image-missing-banner">
            No catalog image found — pick one or more below or upload your own, or continue without.
          </p>
        )}

        <ProductImagePicker
          candidates={draft.imageCandidates}
          selection={draft.imageSelection}
          onChange={draft.setImageSelection}
          alt={draft.title || 'Product'}
        />

        <div className="form-field">
          <label htmlFor="review-title">Title</label>
          <input
            id="review-title"
            value={draft.title}
            onChange={e => draft.setTitle(e.target.value)}
            placeholder="Product title"
          />
        </div>

        <div className="form-field">
          <label htmlFor="review-description">Description</label>
          <textarea
            id="review-description"
            value={draft.description}
            onChange={e => draft.setDescription(e.target.value)}
            placeholder="Product description"
            rows={4}
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="review-quantity">Quantity</label>
            <input
              id="review-quantity"
              type="number"
              min={1}
              value={draft.quantity}
              onChange={e => draft.setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="review-condition">Condition</label>
            <select
              id="review-condition"
              value={draft.condition ?? ''}
              onChange={e => draft.setCondition(e.target.value ? e.target.value as typeof draft.condition : null)}
            >
              <option value="">Select condition</option>
              {ITEM_CONDITIONS.map(c => (
                <option key={c.id} value={c.label}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="review-pricing-mode">Pricing</label>
            <select
              id="review-pricing-mode"
              value={draft.pricingMode}
              onChange={e => draft.setPricingMode(e.target.value as typeof draft.pricingMode)}
            >
              <option value="market">Market price</option>
              <option value="percent_below">% below market</option>
              <option value="manual">Manual price</option>
            </select>
          </div>
          {draft.pricingMode === 'percent_below' && (
            <div className="form-field">
              <label htmlFor="review-percent">Percent below</label>
              <input
                id="review-percent"
                type="number"
                min={1}
                max={99}
                value={draft.percentBelow}
                onChange={e => draft.setPercentBelow(parseInt(e.target.value, 10) || 10)}
              />
            </div>
          )}
          {draft.pricingMode === 'manual' && (
            <div className="form-field">
              <label htmlFor="review-manual-price">Price ($)</label>
              <input
                id="review-manual-price"
                type="number"
                min={0}
                step={0.01}
                value={draft.manualPrice}
                onChange={e => draft.setManualPrice(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
        </div>

        {draft.marketPrice != null && (
          <p className="text-muted-sm">
            Reference price: {formatPrice(draft.marketPrice)}
            {draft.finalPrice != null && ` → List at $${draft.finalPrice.toFixed(2)}`}
          </p>
        )}

        <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Skip
          </button>
          <button type="button" className="btn-primary" onClick={handleConfirm} disabled={!draft.title.trim()}>
            Add to queue
          </button>
        </div>
      </div>
    </Modal>
  );
}
