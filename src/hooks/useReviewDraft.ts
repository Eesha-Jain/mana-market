'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  EbayCondition,
  MarketPricePreference,
  MarketPriceSource,
  PricingMode,
  Product,
} from '@/types';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import type { ProductImageSelection } from '@/components/review/ProductImagePicker';
import {
  buildInitialDescription,
  collectReviewImageCandidates,
  type ProductReviewConfirmPayload,
  type ProductReviewData,
} from '@/utils/productReview';
import {
  composeFromAssignments,
  suggestInitialLineAssignments,
  type OcrLineAssignment,
  type OcrLineTarget,
} from '@/utils/photoScanner';
import { calculateDraftPrice } from '@/utils/pricing';
import {
  resolveInitialSelectedSource,
  resolveProductMarketPrice,
  resolveProductMarketSelection,
} from '@/utils/marketPrice';
import {
  resolveDefaultPricing,
  resolveMarketPricePreference,
} from '@/utils/userSettings';
import type { TextCaseFormat } from '@/utils/textCase';
import {
  applyReviewDefaultOffers,
  collectReviewDefaultOffers,
} from '@/utils/reviewDefaults';

interface UseReviewDraftOptions {
  data: ProductReviewData;
  matchedProduct: Product | null;
  onConfirm: (payload: ProductReviewConfirmPayload) => void;
}

export function useReviewDraft({ data, matchedProduct, onConfirm }: UseReviewDraftOptions) {
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
    ? (initialComposed.description || activeProduct?.description || buildInitialDescription(data.originalUpc, data.originalSku, data.importNotes))
    : (activeProduct?.description ?? initialComposed.description ?? buildInitialDescription(data.originalUpc, data.originalSku, data.importNotes) ?? '');

  const reviewItemKey = `${data.variant}|${data.searchQuery}|${data.photoUrl ?? ''}|${data.originalUpc ?? ''}|${data.originalSku ?? ''}`;

  const [lineAssignments, setLineAssignments] = useState<OcrLineAssignment[]>(initialAssignments);
  const [title, setTitle] = useState(() => applyDefaultTitleCase(defaultTitle));
  const [description, setDescription] = useState(() =>
    applyDefaultDescriptionCase(defaultDescription),
  );
  const [titleEditedManually, setTitleEditedManually] = useState(false);
  const [descriptionEditedManually, setDescriptionEditedManually] = useState(false);
  const [quantity, setQuantity] = useState(data.initialQuantity);
  const [condition, setCondition] = useState<EbayCondition | null>(data.initialCondition);
  const [pricingMode, setPricingMode] = useState<PricingMode>(pricingDefaults.pricingMode);
  const [percentBelow, setPercentBelow] = useState(pricingDefaults.percentBelow);
  const [manualPrice, setManualPrice] = useState(pricingDefaults.manualPrice);
  const resolvedMarketPricePreference = resolveMarketPricePreference(settings);
  const [marketPricePreference, setMarketPricePreference] = useState<MarketPricePreference>(
    resolvedMarketPricePreference,
  );
  const [selectedMarketPriceSource, setSelectedMarketPriceSource] = useState<
    MarketPriceSource | undefined
  >(() => resolveInitialSelectedSource(activeProduct, resolvedMarketPricePreference));
  const [titleCaseUsed, setTitleCaseUsed] = useState<TextCaseFormat | null>(null);
  const [descriptionCaseUsed, setDescriptionCaseUsed] = useState<TextCaseFormat | null>(null);
  const [pendingConfirmPayload, setPendingConfirmPayload] = useState<ProductReviewConfirmPayload | null>(null);
  const [pendingDefaultOffers, setPendingDefaultOffers] = useState<
    ReturnType<typeof collectReviewDefaultOffers>
  >([]);
  const initialPricingRef = useRef(pricingDefaults);

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

  useEffect(() => {
    setLineAssignments(initialAssignments);
    setTitleEditedManually(false);
    setDescriptionEditedManually(false);
    setTitle(applyDefaultTitleCase(defaultTitle));
    setDescription(applyDefaultDescriptionCase(defaultDescription));
    setPricingMode(pricingDefaults.pricingMode);
    setPercentBelow(pricingDefaults.percentBelow);
    setManualPrice(pricingDefaults.manualPrice);
    initialPricingRef.current = pricingDefaults;
    setImageSelection({
      selectedUrl: initialSelectedUrl,
      userImageUrl: undefined,
      preferredImageSource:
        data.variant === 'photo' && data.photoUrl ? 'user' : 'catalog',
    });
  }, [
    reviewItemKey,
    initialAssignments,
    defaultTitle,
    defaultDescription,
    pricingDefaults.pricingMode,
    pricingDefaults.percentBelow,
    pricingDefaults.manualPrice,
    applyDefaultTitleCase,
    applyDefaultDescriptionCase,
    initialSelectedUrl,
    data.variant,
    data.photoUrl,
  ]);

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

  const resetLabelAssignments = () => {
    setTitleEditedManually(false);
    setDescriptionEditedManually(false);
    applyAssignments(initialAssignments, { fromLinePicker: true });
    if (data.parseResult?.fullTitle) {
      setTitle(applyDefaultTitleCase(data.parseResult.fullTitle));
    }
  };

  const buildConfirmPayload = (): ProductReviewConfirmPayload | null => {
    const trimmedTitle = title.trim() || data.searchQuery.trim() || detectedTitle.trim();
    if (!trimmedTitle) return null;

    const trimmedDescription = description.trim();
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

    return {
      query: trimmedTitle,
      source: data.source,
      customTitle: trimmedTitle,
      customDescription: trimmedDescription || undefined,
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
  };

  const handleConfirm = () => {
    const payload = buildConfirmPayload();
    if (!payload) return;

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

  return {
    isPhoto,
    activeProduct,
    detectedTitle,
    initialAssignments,
    lineAssignments,
    title,
    setTitle,
    setTitleEditedManually,
    description,
    setDescription,
    setDescriptionEditedManually,
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
    marketPricePreference,
    setMarketPricePreference,
    selectedMarketPriceSource,
    setSelectedMarketPriceSource,
    titleCaseUsed,
    setTitleCaseUsed,
    descriptionCaseUsed,
    setDescriptionCaseUsed,
    imageSelection,
    setImageSelection,
    imageCandidates,
    market,
    yourPrice,
    setLineTarget,
    moveLine,
    resetLabelAssignments,
    handleConfirm,
    pendingDefaultOffers,
    handleSaveDefaultsConfirm,
    handleSaveDefaultsDecline,
  };
}
