'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ItemCondition, PricingMode, Product } from '@/types';
import type { ProductImageSelection } from '@/components/review/ProductImagePicker';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import {
  buildInitialDescription,
  collectReviewImageCandidates,
  type ProductReviewConfirmPayload,
  type ProductReviewData,
} from '@/utils/review';
import { composeFromAssignments, suggestInitialLineAssignments } from '@/utils/ocr';
import { calculateDraftPrice } from '@/utils/pricing';
import { resolveProductMarketPrice, resolveProductMarketSelection } from '@/utils/pricing';
import { resolveDefaultPricing, resolveMarketPricePreference } from '@/utils/settings';

function buildInitialImageSelection(
  data: ProductReviewData,
  selectedUrl: string | null,
): ProductImageSelection {
  return {
    selectedUrls: selectedUrl ? [selectedUrl] : [],
    preferredImageSource: data.variant === 'photo' && data.photoUrl ? 'user' : 'catalog',
  };
}

interface UseEntryReviewDraftOptions {
  data: ProductReviewData;
  matchedProduct: Product | null;
}

export function useEntryReviewDraft({ data, matchedProduct }: UseEntryReviewDraftOptions) {
  const { settings, applyDefaultTitleCase, applyDefaultDescriptionCase } = useUserSettings();

  const activeProduct = matchedProduct ?? data.suggestedProduct ?? null;
  const pricingDefaults = resolveDefaultPricing(settings, {
    manualPrice: data.initialManualPrice,
    pricingMode: data.initialPricingMode,
    percentBelow: data.initialPercentBelow,
  });

  const initialAssignments = useMemo(
    () => suggestInitialLineAssignments(data.readableLines, data.parseResult ?? null),
    [data.readableLines, data.parseResult],
  );
  const initialComposed = useMemo(
    () => composeFromAssignments(initialAssignments),
    [initialAssignments],
  );

  const detectedTitle =
    data.parseResult?.fullTitle ??
    data.searchQuery ??
    activeProduct?.title ??
    '';

  const defaultTitle =
    data.variant === 'photo'
      ? initialComposed.title || activeProduct?.title || data.searchQuery || detectedTitle
      : activeProduct?.title ?? data.searchQuery ?? detectedTitle;

  const defaultDescription =
    data.variant === 'photo'
      ? initialComposed.description ||
        activeProduct?.description ||
        buildInitialDescription(data.originalUpc, data.originalSku, data.importNotes)
      : activeProduct?.description ??
        buildInitialDescription(data.originalUpc, data.originalSku, data.importNotes) ??
        '';

  const reviewItemKey = `${data.variant}|${data.searchQuery}|${data.photoUrl ?? ''}|${data.originalUpc ?? ''}`;

  const [title, setTitle] = useState(() => applyDefaultTitleCase(defaultTitle));
  const [description, setDescription] = useState(() => applyDefaultDescriptionCase(defaultDescription));
  const [quantity, setQuantity] = useState(data.initialQuantity);
  const [condition, setCondition] = useState<ItemCondition | null>(data.initialCondition);
  const [pricingMode, setPricingMode] = useState<PricingMode>(pricingDefaults.pricingMode);
  const [percentBelow, setPercentBelow] = useState(pricingDefaults.percentBelow);
  const [manualPrice, setManualPrice] = useState(pricingDefaults.manualPrice);

  const marketPreference = resolveMarketPricePreference(settings);
  const initialImageCandidates = useMemo(
    () => collectReviewImageCandidates(data, activeProduct),
    [data, activeProduct],
  );
  const initialSelectedUrl =
    data.variant === 'photo' && data.photoUrl
      ? data.photoUrl
      : activeProduct?.imageUrls[0] ?? initialImageCandidates[0]?.url ?? null;

  const [imageSelection, setImageSelection] = useState<ProductImageSelection>(() =>
    buildInitialImageSelection(data, initialSelectedUrl),
  );

  useEffect(() => {
    setTitle(applyDefaultTitleCase(defaultTitle));
    setDescription(applyDefaultDescriptionCase(defaultDescription));
    setQuantity(data.initialQuantity);
    setCondition(data.initialCondition);
    setPricingMode(pricingDefaults.pricingMode);
    setPercentBelow(pricingDefaults.percentBelow);
    setManualPrice(pricingDefaults.manualPrice);
    setImageSelection(buildInitialImageSelection(data, initialSelectedUrl));
  }, [
    reviewItemKey,
    defaultTitle,
    defaultDescription,
    data.initialQuantity,
    data.initialCondition,
    pricingDefaults.pricingMode,
    pricingDefaults.percentBelow,
    pricingDefaults.manualPrice,
    applyDefaultTitleCase,
    applyDefaultDescriptionCase,
    initialSelectedUrl,
  ]);

  const imageCandidates = useMemo(
    () =>
      collectReviewImageCandidates(
        data,
        activeProduct,
        imageSelection.userImageUrl,
      ),
    [data, activeProduct, imageSelection.userImageUrl],
  );

  const selectedImageUrls = imageSelection.selectedUrls;

  const marketPrice = activeProduct
    ? resolveProductMarketPrice(activeProduct, marketPreference)
    : null;
  const finalPrice = calculateDraftPrice(marketPrice, { pricingMode, percentBelow, manualPrice });

  const buildConfirmPayload = (): ProductReviewConfirmPayload | null => {
    const trimmedTitle = title.trim() || data.searchQuery.trim() || detectedTitle.trim();
    if (!trimmedTitle) return null;

    const trimmedDescription = description.trim();
    const imageUrls = selectedImageUrls.length
      ? [
          ...selectedImageUrls,
          ...(activeProduct?.imageUrls.filter(url => !selectedImageUrls.includes(url)) ?? []),
        ]
      : activeProduct?.imageUrls ?? [];

    const priceSelection = activeProduct
      ? resolveProductMarketSelection(activeProduct, marketPreference)
      : { price: null, source: null, optionId: null };

    const product = activeProduct
      ? {
          ...activeProduct,
          title: detectedTitle || activeProduct.title,
          description: trimmedDescription || activeProduct.description,
          imageUrls,
          marketPrice: priceSelection.price ?? activeProduct.marketPrice,
          marketPriceSource: priceSelection.source ?? activeProduct.marketPriceSource,
        }
      : trimmedDescription || selectedImageUrls.length
        ? {
            title: trimmedTitle,
            description: trimmedDescription,
            imageUrls: selectedImageUrls,
          }
        : undefined;

    return {
      query: trimmedTitle,
      source: data.source,
      customTitle: trimmedTitle || null,
      customDescription: trimmedDescription || null,
      originalUpc: data.originalUpc ?? null,
      originalSku: data.originalSku ?? null,
      quantity,
      condition,
      pricingMode,
      percentBelow,
      price: manualPrice,
      pricingSource: 'amazon',
      category: null,
      notes: '',
      selectedMarketPriceSource: priceSelection.optionId ?? null,
      product: product ?? undefined,
      photoUrl: data.photoUrl ?? null,
      userImageUrl: imageSelection.userImageUrl ?? null,
      preferredImageSource: imageSelection.preferredImageSource,
      selectedImageUrl: selectedImageUrls[0],
      selectedImageUrls,
      parseMeta: data.parseResult
        ? {
            packType: data.parseResult.packType ?? undefined,
            cardCount: data.parseResult.cardCount ?? undefined,
          }
        : undefined,
    };
  };

  return {
    activeProduct,
    title,
    setTitle,
    description,
    setDescription,
    quantity,
    setQuantity,
    condition,
    setCondition,
    pricingMode,
    setPricingMode,
    percentBelow,
    setPercentBelow,
    manualPrice,
    setManualPrice,
    marketPrice,
    finalPrice,
    imageCandidates,
    imageSelection,
    setImageSelection,
    selectedImageUrls,
    buildConfirmPayload,
  };
}
