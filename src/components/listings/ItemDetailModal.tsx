'use client';

import type { EbayCondition, ItemListing } from '@/types';
import {
  EBAY_CONDITIONS,
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
  getEbayListingUrl,
  getItemMarketPrice,
  buildEbayListing,
} from '@/utils/ebayMapper';
import { resolveItemMarketSelection } from '@/utils/marketPrice';
import { getItemStatusLabel, isItemAmbiguous } from '@/utils/itemStatus';
import { ProductExternalLinks } from '@/components/review/ProductExternalLinks';
import { collectReviewImageCandidates } from '@/utils/productReview';
import type { ProductImageSelection } from '@/components/review/ProductImagePicker';
import { ListingEditorModalUI } from './ListingEditorModalUI';
import { useMemo, useState } from 'react';

interface ItemDetailModalProps {
  item: ItemListing;
  onUpdate: (updates: Partial<ItemListing>) => void;
  onClose: () => void;
  onResolveAmbiguous?: () => void;
}

/**
 * Full-screen editor for a single queue item (dashboard / review pages).
 * Renders shared listing UI via ListingEditorModalUI; this file owns
 * item-specific data wiring and the left-column product metadata panel.
 */
export function ItemDetailModal({
  item,
  onUpdate,
  onClose,
  onResolveAmbiguous,
}: ItemDetailModalProps) {
  const product = item.product;

  // ── Derived listing values (pricing, export payload, catalog metadata) ──────
  const img = getItemImageUrl(item);
  const market = getItemMarketPrice(item);
  const marketSelection = resolveItemMarketSelection(item);
  const yourPrice = calculatePrice(item);
  const payload = buildEbayListing(item);
  const productType = resolveItemProductType(item);

  // Image picker needs the same candidate list used during intake review.
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

  // Local mirror of image selection so the picker stays responsive before onUpdate persists.
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

  // ── Condition & quantity (stacked layout for the detail split column) ───────
  const conditionQuantitySection = (
    <div className="condition-quantity-stack">
      <label className="detail-field">
        <span>Condition <span className="required-mark">*</span></span>
        <select
          className="detail-input"
          value={item.condition ?? ''}
          onChange={e =>
            onUpdate({
              condition: e.target.value
                ? (e.target.value as EbayCondition)
                : null,
            })
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
          value={item.quantity}
          onChange={e =>
            onUpdate({ quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
          }
        />
      </label>
    </div>
  );

  // ── Left column: read-only catalog info + ambiguous-match action ──────────
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

      {isItemAmbiguous(item) && onResolveAmbiguous && (
        <button className="btn-primary btn-sm" onClick={onResolveAmbiguous}>
          Select from matches →
        </button>
      )}
    </>
  );

  // ── Post-pricing extras: export tracking and raw eBay JSON preview ────────
  const afterForm = (
    <>
      {item.ebayExportedAt && (
        <div className="ebay-status-box">
          <strong>Exported to eBay</strong>
          <p className="text-muted text-sm">
            {new Date(item.ebayExportedAt).toLocaleString()}
            {item.ebayListingStatus && ` · Status: ${item.ebayListingStatus}`}
          </p>
          <label className="detail-field">
            <span>eBay listing URL</span>
            <input
              id="ebay-listing-url"
              type="url"
              className="detail-input"
              placeholder="https://www.ebay.com/itm/…"
              value={item.ebayListingUrl ?? ''}
              onChange={e =>
                onUpdate({ ebayListingUrl: e.target.value.trim() || undefined })
              }
            />
          </label>
          {getEbayListingUrl(item) && (
            <a
              href={getEbayListingUrl(item)!}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-link btn-sm"
              style={{ display: 'inline-block', marginTop: 6 }}
            >
              View live listing ↗
            </a>
          )}
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
    </>
  );

  return (
    <ListingEditorModalUI
      layout="split"
      title={getItemTitle(item)}
      subtitle={
        <>
          <span className="item-listing-id">{item.listingId}</span>
          {' · '}
          {getItemStatusLabel(item.status)}
          {item.ebayExportedAt && (
            <span className="badge badge--blue" style={{ marginLeft: 8 }}>
              Already in eBay
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
      onTitleChange={v => onUpdate({ customTitle: v || undefined })}
      titlePlaceholder={getDetectedTitle(item)}
      titleHint={
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
      descriptionValue={getItemListingDescription(item)}
      onDescriptionChange={v => onUpdate(patchItemListingDescription(v))}
      descriptionPlaceholder={product?.description || 'Product description and seller notes…'}
      descriptionHint={
        !getItemListingDescription(item) && product?.description ? (
          <span className="text-muted text-sm">Using detected description</span>
        ) : undefined
      }
      conditionQuantitySection={conditionQuantitySection}
      product={product}
      marketPricePreference={item.marketPricePreference ?? 'ebay'}
      selectedMarketPriceSource={item.selectedMarketPriceSource}
      onMarketPricePreferenceChange={marketPricePreference =>
        onUpdate({ marketPricePreference })
      }
      onSelectedMarketPriceSourceChange={selectedMarketPriceSource =>
        onUpdate({ selectedMarketPriceSource })
      }
      marketPrice={market}
      pricingMode={item.pricingMode}
      percentBelow={item.percentBelow}
      manualPrice={item.manualPrice}
      finalPrice={yourPrice}
      onPricingModeChange={pricingMode => onUpdate({ pricingMode })}
      onPercentBelowChange={percentBelow => onUpdate({ percentBelow })}
      onManualPriceChange={manualPrice => onUpdate({ manualPrice })}
      afterForm={afterForm}
      secondaryLabel="Close"
      onSecondary={onClose}
    />
  );
}
