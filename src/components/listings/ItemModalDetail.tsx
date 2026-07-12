'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ItemListing } from '@/types';
import {
  getItemImageUrl,
  getItemTitle,
  getDetectedTitle,
  hasCustomTitle,
  getItemListingDescription,
  patchItemListingDescription,
  itemHasListingImage,
} from '@/types';
import { resolveItemProductType } from '@/utils/productType';
import { getMarketPriceSourceLabel } from '@/utils/productApi';
import {
  calculatePrice,
  EBAY_SELLER_ACTIVE_LISTINGS_URL,
  getEbayListingUrl,
  getItemMarketPrice,
} from '@/utils/ebayMapper';
import { resolveItemMarketSelection } from '@/utils/marketPrice';
import { getItemStatusLabel, isItemAmbiguous } from '@/utils/itemStatus';
import {
  isItemListingLocked,
  isListedToggleOn,
  listingListedToggleUpdates,
} from '@/utils/listingLock';
import { ProductExternalLinks } from '@/components/review/ProductExternalLinks';
import { collectReviewImageCandidates } from '@/utils/productReview';
import type { ProductImageSelection } from '@/components/review/ProductImagePicker';
import { useItems } from '@/contexts/ItemsContext';
import { ConditionQuantityFields } from './ConditionQuantityFields';
import { ItemModalShell } from './ItemModalShell';

export interface ItemModalDetailProps {
  mode: 'detail';
  item: ItemListing;
  onClose: () => void;
  onResolveAmbiguous?: () => void;
}

export function ItemModalDetail({
  item,
  onClose,
  onResolveAmbiguous,
}: Omit<ItemModalDetailProps, 'mode'>) {
  const { updateItem, removeItem } = useItems();
  const product = item.product;
  const readOnly = isItemListingLocked(item);

  const img = getItemImageUrl(item);
  const market = getItemMarketPrice(item);
  const marketSelection = resolveItemMarketSelection(item);
  const yourPrice = calculatePrice(item);
  const productType = resolveItemProductType(item);
  const ebayUrl = getEbayListingUrl(item);

  const imageCandidates = useMemo(
    () => collectReviewImageCandidates(
      {
        variant: item.source === 'photo' ? 'photo' : 'entry',
        searchQuery: item.query,
        photoUrl: item.photoUrl,
        readableLines: [],
        matchedProduct: product ?? null,
        ambiguousResults: null,
        initialQuantity: item.quantity,
        initialCondition: item.condition,
        initialPricingMode: item.pricingMode,
        initialPercentBelow: item.percentBelow,
        initialManualPrice: item.manualPrice,
        source: item.source,
        imageCandidates: product?.imageCandidates,
      },
      product ?? null,
      item.userImageUrl,
    ),
    [item, product],
  );

  const [imageSelection, setImageSelection] = useState<ProductImageSelection>(() => ({
    selectedUrl: img,
    userImageUrl: item.userImageUrl,
    preferredImageSource: item.preferredImageSource ?? (item.userImageUrl ? 'user' : 'catalog'),
  }));

  useEffect(() => {
    const nextImg = getItemImageUrl(item);
    setImageSelection({
      selectedUrl: nextImg,
      userImageUrl: item.userImageUrl,
      preferredImageSource: item.preferredImageSource ?? (item.userImageUrl ? 'user' : 'catalog'),
    });
  }, [item.id, item.userImageUrl, item.preferredImageSource, item.product?.imageUrls]);

  const applyImageSelection = (selection: ProductImageSelection) => {
    if (readOnly) return;
    setImageSelection(selection);

    const updates: Partial<ItemListing> = {
      userImageUrl: selection.userImageUrl,
      preferredImageSource: selection.preferredImageSource,
    };

    if (product && selection.selectedUrl) {
      updates.product = {
        ...product,
        imageUrls: [
          selection.selectedUrl,
          ...product.imageUrls.filter(url => url !== selection.selectedUrl),
        ],
      };
    }

    updateItem(item.id, updates);
  };

  const conditionQuantitySection = (
    <ConditionQuantityFields
      layout="stack"
      condition={item.condition}
      quantity={item.quantity}
      readOnly={readOnly}
      onConditionChange={condition => updateItem(item.id, { condition })}
      onQuantityChange={quantity => updateItem(item.id, { quantity })}
    />
  );

  const mediaAside = (
    <>
      {product && (
        <div className="item-detail-card-info">
          <h3 className="item-detail-section-title">Product Details</h3>
          <dl className="detail-dl">
            {productType && <><dt>Product type</dt><dd>{productType}</dd></>}
            {item.detectedCardCount && <><dt>Contents</dt><dd>{item.detectedCardCount}</dd></>}
            {product.brand && <><dt>Brand</dt><dd>{product.brand}</dd></>}
            {product.upc && <><dt>UPC</dt><dd>{product.upc}</dd></>}
            {marketSelection.source && (
              <><dt>Price source</dt>
              <dd>{getMarketPriceSourceLabel(marketSelection.source, 'short')}</dd></>
            )}
            {product.soldCount != null && (
              <><dt>eBay sold</dt><dd>{product.soldCount} listings</dd></>
            )}
            {product.priceRange && (
              <><dt>Price range</dt>
              <dd>${product.priceRange.low}–${product.priceRange.high}</dd></>
            )}
          </dl>
          {product.description && (
            <p className="text-muted-sm">{product.description}</p>
          )}
          {product.imageUrls.length > 1 && (
            <div className="item-detail-gallery">
              {product.imageUrls.slice(1, 5).map((url, i) => (
                <img key={i} src={url} alt="" className="item-detail-gallery-thumb" />
              ))}
            </div>
          )}
          <ProductExternalLinks
            ebaySearchUrl={product.ebaySearchUrl}
            tcgplayerUrl={product.tcgplayerUrl}
            className="product-external-links product-external-links--detail"
            linkClassName="btn-link btn-sm"
          />
        </div>
      )}

      {isItemAmbiguous(item) && onResolveAmbiguous && !readOnly && (
        <button className="btn-primary btn-sm" onClick={onResolveAmbiguous}>
          Select from matches →
        </button>
      )}
    </>
  );

  const listedTrackingSection = readOnly ? (
    <div className="ebay-status-box">
      <strong>On eBay</strong>
      {item.ebayExportedAt ? (
        <p className="text-muted-sm">
          Exported from Mana Market · {new Date(item.ebayExportedAt).toLocaleString()}
        </p>
      ) : (
        <p className="text-muted-sm">Marked as listed outside this app</p>
      )}
      {item.ebayListingStatus && (
        <p className="text-muted-sm">Status: {item.ebayListingStatus}</p>
      )}
      {ebayUrl ? (
        <a
          href={ebayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-link btn-sm"
        >
          View listing on eBay ↗
        </a>
      ) : (
        <p className="text-muted-sm">No listing URL saved</p>
      )}
      <a
        href={EBAY_SELLER_ACTIVE_LISTINGS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-link btn-sm"
      >
        Open eBay Seller Hub ↗
      </a>
    </div>
  ) : null;

  const handleDelete = () => {
    if (window.confirm(`Delete "${getItemTitle(item)}" from your queue?`)) {
      removeItem(item.id);
      onClose();
    }
  };

  return (
    <ItemModalShell
      layout="split"
      readOnly={readOnly}
      title={getItemTitle(item)}
      subtitle={
        <>
          <span className="item-listing-id">{item.listingId}</span>
          {' · '}
          {getItemStatusLabel(item.status)}
          {readOnly && (
            <span className="badge badge--blue" style={{ marginLeft: 8 }}>
              Listed on eBay
            </span>
          )}
        </>
      }
      onClose={onClose}
      imageMissingBanner={
        !itemHasListingImage(item) ? (
          <div className="product-image-missing-banner">
            No listing image yet — upload your own below.
          </div>
        ) : undefined
      }
      imageCandidates={imageCandidates}
      imageSelection={imageSelection}
      onImageChange={applyImageSelection}
      imageAlt={getItemTitle(item)}
      mediaAside={mediaAside}
      formSectionTitle="Listing Settings"
      titleValue={item.customTitle ?? ''}
      onTitleChange={v => updateItem(item.id, { customTitle: v || undefined })}
      titlePlaceholder={getDetectedTitle(item)}
      titleHint={
        !readOnly && hasCustomTitle(item) ? (
          <button
            type="button"
            className="btn-link btn-sm"
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
            onClick={() => updateItem(item.id, { customTitle: undefined })}
          >
            Reset to detected title
          </button>
        ) : !readOnly ? (
          <span className="text-muted-sm">
            Detected: {getDetectedTitle(item)}
          </span>
        ) : undefined
      }
      descriptionValue={getItemListingDescription(item)}
      onDescriptionChange={v => updateItem(item.id, patchItemListingDescription(v))}
      descriptionPlaceholder={product?.description || 'Product description…'}
      descriptionHint={
        !readOnly && !getItemListingDescription(item) && product?.description ? (
          <span className="text-muted-sm">Using detected description</span>
        ) : undefined
      }
      conditionQuantitySection={conditionQuantitySection}
      product={product}
      marketPricePreference={item.marketPricePreference ?? 'ebay'}
      selectedMarketPriceSource={item.selectedMarketPriceSource}
      onMarketPricePreferenceChange={marketPricePreference =>
        updateItem(item.id, { marketPricePreference })
      }
      onSelectedMarketPriceSourceChange={selectedMarketPriceSource =>
        updateItem(item.id, { selectedMarketPriceSource })
      }
      marketPrice={market}
      pricingMode={item.pricingMode}
      percentBelow={item.percentBelow}
      manualPrice={item.manualPrice}
      finalPrice={yourPrice}
      onPricingModeChange={pricingMode => updateItem(item.id, { pricingMode })}
      onPercentBelowChange={percentBelow => updateItem(item.id, { percentBelow })}
      onManualPriceChange={manualPrice => updateItem(item.id, { manualPrice })}
      listedToggle={{
        checked: isListedToggleOn(item),
        onChange: checked => updateItem(item.id, listingListedToggleUpdates(checked)),
      }}
      afterForm={listedTrackingSection}
      onDelete={handleDelete}
      secondaryLabel="Close"
      onSecondary={onClose}
    />
  );
}
