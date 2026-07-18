'use client';

import type { Product } from '@/types';
import {
  formatPrice,
  formatPriceRange,
  getMarketPriceSourceLabel,
  getProductMarketPrice,
} from '@/utils/productApi';
import { getAmazonProductUrl, getUpcCatalogUrl } from '@/utils/marketPrice';
import { ProductExternalLinks } from './ProductExternalLinks';

interface ProductMatchInsightProps {
  product: Product;
  /** When set, overrides the static product.marketPrice (updates with source picker). */
  marketPrice?: number | null;
  /** Display label for the active market source. */
  marketSourceLabel?: string;
  onPickDifferent?: () => void;
}

export function ProductMatchInsight({
  product,
  marketPrice,
  marketSourceLabel,
  onPickDifferent,
}: ProductMatchInsightProps) {
  const market = marketPrice !== undefined ? marketPrice : getProductMarketPrice(product);
  const priceRange = formatPriceRange(product.priceRange);
  const sourceLabel =
    marketSourceLabel ?? getMarketPriceSourceLabel(product.marketPriceSource);

  return (
    <div className="product-match-panel">
      <div className="product-match-panel-head">
        <span className="product-match-panel-label">Online match</span>
        {onPickDifferent && (
          <button
            type="button"
            className="btn-link btn-sm product-match-panel-change"
            onClick={onPickDifferent}
          >
            Change
          </button>
        )}
      </div>

      <p className="product-match-panel-title" title={product.title}>
        {product.title}
      </p>

      <div className="product-match-panel-meta">
        {(product.upc || product.brand) && (
          <div className="product-match-identifiers">
            {product.upc && (
              <span className="badge badge--gray" title="Barcode used for lookup">
                UPC {product.upc}
              </span>
            )}
            {product.brand && (
              <span className="badge badge--gray">{product.brand}</span>
            )}
          </div>
        )}

        <div className="product-match-price-row">
          <div className="product-match-price-block">
            <span className="product-match-price-label">Market price</span>
            <strong className={`product-match-price${market == null ? ' product-match-price--unknown' : ''}`}>
              {market != null ? formatPrice(market) : 'Not available'}
            </strong>
          </div>
          {market != null && (
            <span className="product-match-panel-source">{sourceLabel}</span>
          )}
        </div>

        {market == null && (
          <span className="product-match-panel-source">
            No sold-listing or catalog price found — use the links below to verify this product.
          </span>
        )}

        {priceRange && (
          <span className="product-match-panel-source">
            {market != null ? 'Typical range: ' : 'Catalog range: '}
            {priceRange}
          </span>
        )}

        {product.soldCount != null && product.soldCount > 0 && (
          <span className="product-match-panel-source">
            {product.soldCount} recent eBay sold listings
          </span>
        )}
      </div>

      <ProductExternalLinks
        amazonUrl={getAmazonProductUrl(product)}
        upcUrl={getUpcCatalogUrl(product)}
        ebaySearchUrl={product.ebaySearchUrl}
        tcgplayerUrl={product.tcgplayerUrl}
      />
    </div>
  );
}
