'use client';

import { useMemo, useState } from 'react';
import type { ItemCondition, MarketPricePreference, UserItemWithCatalog } from '@/types';
import type { ProductImageSelection } from '@/components/review/ProductImagePicker';
import { ItemModalShell } from '@/components/listings/ItemModalShell';
import { ProductMatchInsight } from '@/components/review/ProductMatchInsight';
import { collectReviewImageCandidates } from '@/utils/review';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { resolveMarketPricePreference } from '@/utils/settings';
import { calculateDraftPrice, resolveItemMarketPrice } from '@/utils/pricing';
import {
  getMarketPriceOptionId,
  getMarketPriceOptions,
  optionDisplayLabel,
  resolveProductMarketSelection,
} from '@/utils/marketPrice';
import {
  catalogToProduct,
  getDetectedTitle,
  getItemListingDescription,
  getItemSelectedImageUrls,
  getItemTitle,
  patchItemListingDescription,
} from '@/utils/items';

interface UserItemModalProps {
  item: UserItemWithCatalog;
  onClose: () => void;
  onSave: (updates: Partial<UserItemWithCatalog>) => void;
  onSaveAsDraft?: (updates: Partial<UserItemWithCatalog>) => void;
  saveAsDraftLabel?: string;
  onDelete?: () => void;
  readOnly?: boolean;
}

export function UserItemModal({
  item,
  onClose,
  onSave,
  onSaveAsDraft,
  saveAsDraftLabel,
  onDelete,
  readOnly = false,
}: UserItemModalProps) {
  const { settings } = useUserSettings();
  const product = useMemo(() => catalogToProduct(item.catalog, item), [item]);

  const [title, setTitle] = useState(getItemTitle(item));
  const [description, setDescription] = useState(getItemListingDescription(item));
  const [quantity, setQuantity] = useState(item.quantity);
  const [condition, setCondition] = useState<ItemCondition | null>(item.condition);
  const [pricingMode, setPricingMode] = useState(item.pricingMode);
  const [percentBelow, setPercentBelow] = useState(item.percentBelow);
  const [manualPrice, setManualPrice] = useState(item.price);
  const [marketPricePreference, setMarketPricePreference] = useState<MarketPricePreference>(
    resolveMarketPricePreference(settings),
  );
  const [selectedMarketPriceSource, setSelectedMarketPriceSource] = useState<
    string | undefined
  >(item.selectedMarketPriceSource ?? undefined);
  const [imageSelection, setImageSelection] = useState<ProductImageSelection>(() => ({
    selectedUrls: getItemSelectedImageUrls(item),
    userImageUrl: item.userImageUrl ?? undefined,
    preferredImageSource: item.preferredImageSource ?? 'catalog',
  }));

  const reviewData = useMemo(
    () => ({
      variant: item.source === 'photo' ? ('photo' as const) : ('entry' as const),
      searchQuery: item.query,
      originalUpc: item.originalUpc ?? undefined,
      originalSku: item.originalSku ?? undefined,
      photoUrl: item.photoUrl ?? undefined,
      readableLines: [],
      matchedProduct: product,
      ambiguousResults: null,
      initialQuantity: item.quantity,
      initialCondition: item.condition,
      initialPricingMode: item.pricingMode,
      initialPercentBelow: item.percentBelow,
      initialManualPrice: item.price,
      source: item.source,
    }),
    [item, product],
  );

  const imageCandidates = useMemo(
    () => collectReviewImageCandidates(reviewData, product, item.userImageUrl ?? undefined),
    [reviewData, product, item.userImageUrl],
  );

  const marketPrice = useMemo(
    () => resolveItemMarketPrice(item, marketPricePreference, selectedMarketPriceSource ?? null),
    [item, marketPricePreference, selectedMarketPriceSource],
  );

  const marketSourceLabel = useMemo(() => {
    if (!product) return undefined;
    const selection = resolveProductMarketSelection(
      product,
      marketPricePreference,
      selectedMarketPriceSource ?? null,
    );
    const option = getMarketPriceOptions(product).find(
      o => getMarketPriceOptionId(o) === selection.optionId,
    );
    return option ? optionDisplayLabel(option) : undefined;
  }, [product, marketPricePreference, selectedMarketPriceSource]);

  const finalPrice = useMemo(
    () =>
      calculateDraftPrice(marketPrice, {
        pricingMode,
        percentBelow,
        manualPrice,
      }),
    [marketPrice, pricingMode, percentBelow, manualPrice],
  );

  const detectedTitle = getDetectedTitle(item);

  const handleSave = () => {
    const selectedUrls = imageSelection.selectedUrls;
    const updates: Partial<UserItemWithCatalog> = {
      customTitle: title.trim() !== detectedTitle ? title.trim() : null,
      ...patchItemListingDescription(description),
      quantity,
      condition,
      pricingMode,
      percentBelow,
      price: finalPrice ?? manualPrice,
      imageUrl: selectedUrls[0] ?? null,
      imageUrls: selectedUrls,
      userImageUrl: imageSelection.userImageUrl ?? null,
      preferredImageSource: imageSelection.preferredImageSource,
      selectedMarketPriceSource: selectedMarketPriceSource ?? null,
    };
    onSave(updates);
    onClose();
  };

  const handleSaveAsDraft = () => {
    if (!onSaveAsDraft) return;
    const selectedUrls = imageSelection.selectedUrls;
    onSaveAsDraft({
      customTitle: title.trim() !== detectedTitle ? title.trim() : null,
      ...patchItemListingDescription(description),
      quantity,
      condition,
      pricingMode,
      percentBelow,
      price: finalPrice ?? manualPrice,
      imageUrl: selectedUrls[0] ?? null,
      imageUrls: selectedUrls,
      userImageUrl: imageSelection.userImageUrl ?? null,
      preferredImageSource: imageSelection.preferredImageSource,
      selectedMarketPriceSource: selectedMarketPriceSource ?? null,
    });
  };

  return (
    <ItemModalShell
      overlayClassName="modal-overlay--entry-review"
      modalClassName="photo-review-modal item-edit-modal"
      title="Edit item"
      subtitle={
        readOnly
          ? 'This item is queued for export. Move it back to Reviewed to edit.'
          : 'Update listing details, pricing, and image before saving.'
      }
      onClose={onClose}
      readOnly={readOnly}
      imageMissingBanner={
        imageSelection.selectedUrls.length === 0 ? (
          <div className="product-image-missing-banner">
            No image selected — pick one or more below or upload your own.
          </div>
        ) : undefined
      }
      imageCandidates={imageCandidates}
      imageSelection={imageSelection}
      onImageChange={setImageSelection}
      imageAlt={title || 'Product'}
      titleValue={title}
      onTitleChange={setTitle}
      titlePlaceholder={detectedTitle || 'Product title…'}
      titleHint={
        detectedTitle && title !== detectedTitle ? (
          <span className="text-muted-sm">Detected: {detectedTitle}</span>
        ) : undefined
      }
      descriptionValue={description}
      onDescriptionChange={setDescription}
      descriptionPlaceholder="Product description…"
      condition={condition}
      quantity={quantity}
      onConditionChange={setCondition}
      onQuantityChange={setQuantity}
      matchInsight={
        product ? (
          <ProductMatchInsight
            product={product}
            marketPrice={marketPrice}
            marketSourceLabel={marketSourceLabel}
          />
        ) : undefined
      }
      product={product}
      marketPricePreference={marketPricePreference}
      selectedMarketPriceSource={selectedMarketPriceSource}
      onMarketPricePreferenceChange={setMarketPricePreference}
      onSelectedMarketPriceSourceChange={setSelectedMarketPriceSource}
      marketPrice={marketPrice}
      pricingMode={pricingMode}
      percentBelow={percentBelow}
      manualPrice={manualPrice}
      finalPrice={finalPrice}
      onPricingModeChange={setPricingMode}
      onPercentBelowChange={setPercentBelow}
      onManualPriceChange={setManualPrice}
      onDelete={readOnly ? undefined : onDelete}
      footerBefore={
        !readOnly && onSaveAsDraft ? (
          <button type="button" className="btn-link" onClick={handleSaveAsDraft}>
            {saveAsDraftLabel ?? 'Save as draft'}
          </button>
        ) : undefined
      }
      secondaryLabel={readOnly ? 'Close' : 'Cancel'}
      onSecondary={onClose}
      primaryLabel={readOnly ? undefined : 'Save'}
      onPrimary={readOnly ? undefined : handleSave}
    />
  );
}
