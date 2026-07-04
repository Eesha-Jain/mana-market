'use client';

import type { Product } from '../types';
import { formatPrice, getMarketPriceSourceLabel } from '../utils/productApi';
import { Modal } from './Modal';

interface AmbiguousModalProps {
  query: string;
  results: Product[];
  onSelect: (product: Product) => void;
  onClose: () => void;
}

export function AmbiguousModal({ query, results, onSelect, onClose }: AmbiguousModalProps) {
  return (
    <Modal
      wide
      title="Multiple matches found"
      subtitle={`"${query}" matched ${results.length} products — pick the exact product, then review listing details.`}
      onClose={onClose}
      bodyClassName="ambiguous-grid"
    >
      {results.map((product, i) => {
        const img = product.imageUrls[0];

        return (
          <button
            key={`${product.title}-${i}`}
            className="ambiguous-card"
            onClick={() => onSelect(product)}
          >
            {img ? (
              <img
                src={img}
                alt={product.title}
                className="ambiguous-card-img ambiguous-card-img--product"
                loading="lazy"
              />
            ) : (
              <div className="ambiguous-card-img ambiguous-card-img--placeholder">📦</div>
            )}
            <div className="ambiguous-card-info">
              <span className="ambiguous-card-name">{product.title}</span>
              {product.brand && <span className="ambiguous-card-set">{product.brand}</span>}
              {product.upc && <span className="ambiguous-card-set">UPC: {product.upc}</span>}
              <span className="ambiguous-card-price-label">Market price</span>
              <span className="ambiguous-card-price">
                {formatPrice(product.marketPrice ?? null)}
              </span>
              {product.marketPrice != null && product.marketPriceSource && (
                <span className="ambiguous-card-set">
                  {getMarketPriceSourceLabel(product.marketPriceSource)}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </Modal>
  );
}
