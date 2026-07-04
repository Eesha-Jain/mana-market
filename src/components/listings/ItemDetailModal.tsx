'use client';

import type { ItemListing } from '@/types';
import { getItemImageUrl, getItemTitle, getDetectedTitle, hasCustomTitle, getItemListingDescription, patchItemListingDescription, itemHasListingImage } from '@/types';
import { resolveItemProductType } from '@/utils/productType';
import { getMarketPriceSourceLabel } from '@/utils/productApi';
import { calculatePrice, getItemMarketPrice, buildEbayListing } from '@/utils/ebayMapper';
import { resolveItemMarketSelection } from '@/utils/marketPrice';
import { getItemStatusLabel } from '@/utils/itemStatus';
import { LabeledFieldWithCase } from '@/components/ui/CaseFormatToolbar';
import { ConditionQuantityFields } from './ConditionQuantityFields';
import { ListingPricingFields } from './ListingPricingFields';
import { MarketPriceSourceFields } from './MarketPriceSourceFields';
import { ProductExternalLinks } from '@/components/review/ProductExternalLinks';
import { collectReviewImageCandidates } from '@/utils/productReview';
import { ProductImagePicker, type ProductImageSelection } from '@/components/review/ProductImagePicker';
import { useMemo, useState } from 'react';

interface ItemDetailModalProps {
  item: ItemListing;
  onUpdate: (updates: Partial<ItemListing>) => void;
  onClose: () => void;
  onResolveAmbiguous?: () => void;
}

export function ItemDetailModal({
  item,
  onUpdate,
  onClose,
  onResolveAmbiguous,
}: ItemDetailModalProps) {
  const product = item.product;
  const img = getItemImageUrl(item);
  const market = getItemMarketPrice(item);
  const marketSelection = resolveItemMarketSelection(item);
  const yourPrice = calculatePrice(item);
  const payload = buildEbayListing(item);
  const productType = resolveItemProductType(item);

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

  const applyImageSelection = (selection: ProductImageSelection) => {
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

    onUpdate(updates);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide item-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{getItemTitle(item)}</h2>
            <p className="modal-subtitle">
              <span className="item-listing-id">{item.listingId}</span>
              {' · '}
              {getItemStatusLabel(item.status)}
              {item.ebayExportedAt && (
                <span className="badge badge--blue" style={{ marginLeft: 8 }}>
                  Already in eBay
                </span>
              )}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body item-detail-body">
          <div className="item-detail-layout">
            <div className="item-detail-media">
              {!itemHasListingImage(item) && (
                <div className="product-image-missing-banner">
                  No listing image yet — upload your own below.
                </div>
              )}

              <ProductImagePicker
                candidates={imageCandidates}
                selection={imageSelection}
                onChange={applyImageSelection}
                alt={getItemTitle(item)}
              />

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
                    <p className="text-muted text-sm">{product.description}</p>
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

              {item.status === 'ambiguous' && onResolveAmbiguous && (
                <button className="btn-primary btn-sm" onClick={onResolveAmbiguous}>
                  Select from matches →
                </button>
              )}
            </div>

            <div className="item-detail-form">
              <h3 className="item-detail-section-title">Listing Settings</h3>

              <LabeledFieldWithCase
                label="Listing title"
                placeholder={getDetectedTitle(item)}
                value={item.customTitle ?? ''}
                onChange={v => onUpdate({ customTitle: v || undefined })}
                hint={
                  hasCustomTitle(item) ? (
                    <button
                      type="button"
                      className="btn-link btn-sm"
                      style={{ alignSelf: 'flex-start', marginTop: 4 }}
                      onClick={() => onUpdate({ customTitle: undefined })}
                    >
                      Reset to detected title
                    </button>
                  ) : (
                    <span className="text-muted text-sm">
                      Detected: {getDetectedTitle(item)}
                    </span>
                  )
                }
              />

              <LabeledFieldWithCase
                label="Listing description"
                multiline
                rows={5}
                placeholder={product?.description || 'Product description and seller notes…'}
                value={getItemListingDescription(item)}
                onChange={v => onUpdate(patchItemListingDescription(v))}
                hint={
                  !getItemListingDescription(item) && product?.description ? (
                    <span className="text-muted text-sm">Using detected description</span>
                  ) : undefined
                }
              />

              <ConditionQuantityFields
                condition={item.condition}
                quantity={item.quantity}
                onConditionChange={condition => onUpdate({ condition })}
                onQuantityChange={quantity => onUpdate({ quantity })}
                layout="stack"
              />

              <MarketPriceSourceFields
                product={product}
                preference={item.marketPricePreference ?? 'ebay'}
                selectedSource={item.selectedMarketPriceSource}
                onPreferenceChange={marketPricePreference =>
                  onUpdate({ marketPricePreference })
                }
                onSelectedSourceChange={selectedMarketPriceSource =>
                  onUpdate({ selectedMarketPriceSource })
                }
              />

              <ListingPricingFields
                marketPrice={market}
                pricingMode={item.pricingMode}
                percentBelow={item.percentBelow}
                manualPrice={item.manualPrice}
                finalPrice={yourPrice}
                onPricingModeChange={pricingMode => onUpdate({ pricingMode })}
                onPercentBelowChange={percentBelow => onUpdate({ percentBelow })}
                onManualPriceChange={manualPrice => onUpdate({ manualPrice })}
              />

              {item.ebayExportedAt && (
                <div className="ebay-status-box">
                  <strong>Exported to eBay</strong>
                  <p className="text-muted text-sm">
                    {new Date(item.ebayExportedAt).toLocaleString()}
                    {item.ebayListingStatus && ` · Status: ${item.ebayListingStatus}`}
                  </p>
                  <select
                    className="detail-input"
                    value={item.ebayListingStatus ?? 'exported'}
                    onChange={e =>
                      onUpdate({
                        ebayListingStatus: e.target.value as ItemListing['ebayListingStatus'],
                      })
                    }
                  >
                    <option value="exported">Exported</option>
                    <option value="active">Active on eBay</option>
                    <option value="sold">Sold</option>
                    <option value="ended">Listing ended</option>
                  </select>
                </div>
              )}

              {payload && (
                <details className="payload-details">
                  <summary>eBay payload preview</summary>
                  <pre className="json-preview json-preview--sm">
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
