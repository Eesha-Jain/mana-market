'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import type { ImageCandidate, ImageCandidateSource } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { uploadProductImage } from '@/utils/imageUpload';

const SOURCE_LABELS: Record<ImageCandidateSource, string> = {
  upc_catalog: 'UPC catalog',
  ebay_sold: 'eBay sold',
  user_upload: 'Your upload',
  user_photo: 'Your photo',
};

export interface ProductImageSelection {
  selectedUrl: string | null;
  userImageUrl?: string;
  preferredImageSource: 'catalog' | 'user';
}

interface ProductImagePickerProps {
  candidates: ImageCandidate[];
  selection: ProductImageSelection;
  onChange: (selection: ProductImageSelection) => void;
  alt?: string;
  emptyMessage?: string;
}

function dedupeCandidates(candidates: ImageCandidate[]): ImageCandidate[] {
  const seen = new Set<string>();
  return candidates.filter(candidate => {
    if (!candidate.url || seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

export function buildImageCandidatesFromProduct(
  imageUrls: string[] = [],
  imageCandidates?: ImageCandidate[],
  photoUrl?: string,
  userImageUrl?: string,
): ImageCandidate[] {
  const merged: ImageCandidate[] = [...(imageCandidates ?? [])];

  for (const url of imageUrls) {
    if (!merged.some(candidate => candidate.url === url)) {
      merged.push({ url, source: 'ebay_sold' });
    }
  }

  if (userImageUrl && !merged.some(candidate => candidate.url === userImageUrl)) {
    merged.unshift({ url: userImageUrl, source: 'user_upload' });
  }

  if (photoUrl && !merged.some(candidate => candidate.url === photoUrl)) {
    merged.unshift({ url: photoUrl, source: 'user_photo' });
  }

  return dedupeCandidates(merged);
}

export function getImageSourceLabel(source: ImageCandidateSource): string {
  return SOURCE_LABELS[source];
}

export function ProductImagePicker({
  candidates,
  selection,
  onChange,
  alt = 'Product',
  emptyMessage = 'No image found online — upload your own',
}: ProductImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const allCandidates = dedupeCandidates(candidates);
  const heroUrl = selection.selectedUrl ?? allCandidates[0]?.url ?? null;

  const selectCatalog = (url: string) => {
    onChange({
      selectedUrl: url,
      userImageUrl: selection.userImageUrl,
      preferredImageSource: 'catalog',
    });
  };

  const selectUser = (url: string) => {
    onChange({
      selectedUrl: url,
      userImageUrl: url,
      preferredImageSource: 'user',
    });
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }

    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      selectUser(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="product-image-picker" aria-label="Listing image">
      {heroUrl ? (
        <div className="product-image-picker-hero">
          <img src={heroUrl} alt={alt} className="photo-review-hero-image" />
        </div>
      ) : (
        <div className="product-image-picker-empty">
          <span className="product-image-picker-empty-icon" aria-hidden="true">📷</span>
          <p>{emptyMessage}</p>
        </div>
      )}

      {allCandidates.length > 0 && (
        <div className="product-image-picker-candidates">
          <span className="product-image-picker-label">Choose an image</span>
          <div className="product-image-picker-grid">
            {allCandidates.map(candidate => {
              const isSelected = heroUrl === candidate.url;
              const isUser = candidate.source === 'user_upload' || candidate.source === 'user_photo';
              return (
                <button
                  key={candidate.url}
                  type="button"
                  className={`product-image-picker-thumb${isSelected ? ' product-image-picker-thumb--active' : ''}`}
                  onClick={() => (isUser ? selectUser(candidate.url) : selectCatalog(candidate.url))}
                  title={getImageSourceLabel(candidate.source)}
                >
                  <img src={candidate.url} alt="" />
                  <span className="product-image-picker-thumb-badge">
                    {getImageSourceLabel(candidate.source)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="product-image-picker-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleUpload}
        />
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? 'Uploading…' : heroUrl ? 'Upload different image' : 'Upload your own'}
        </button>
      </div>
    </section>
  );
}
