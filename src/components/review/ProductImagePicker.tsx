'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { ImageCandidate, ImageCandidateSource, PreferredImageSource } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { uploadProductImage } from '@/utils/imageUpload';

const SOURCE_LABELS: Record<ImageCandidateSource, string> = {
  amazon_catalog: 'Amazon catalog',
  upc_catalog: 'UPC catalog',
  user_upload: 'Your upload',
  user_photo: 'Your photo',
};

export interface ProductImageSelection {
  /** Ordered selected listing images; first is the cover / primary. */
  selectedUrls: string[];
  userImageUrl?: string;
  preferredImageSource: PreferredImageSource;
}

interface ProductImagePickerProps {
  candidates: ImageCandidate[];
  selection: ProductImageSelection;
  onChange: (selection: ProductImageSelection) => void;
  alt?: string;
  emptyMessage?: string;
  readOnly?: boolean;
}

function dedupeCandidates(candidates: ImageCandidate[]): ImageCandidate[] {
  const seen = new Set<string>();
  return candidates.filter(candidate => {
    if (!candidate.url || seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  return urls.filter(url => {
    if (!url || seen.has(url)) return false;
    seen.add(url);
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
      merged.push({ url, source: 'amazon_catalog' });
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

export function getPrimaryImageUrl(selection: ProductImageSelection): string | null {
  return selection.selectedUrls[0] ?? null;
}

function preferredSourceForUrls(
  urls: string[],
  candidates: ImageCandidate[],
  userImageUrl?: string,
): PreferredImageSource {
  const primary = urls[0];
  if (!primary) return userImageUrl ? 'user' : 'catalog';
  const match = candidates.find(c => c.url === primary);
  if (match?.source === 'user_upload' || match?.source === 'user_photo') return 'user';
  if (userImageUrl && primary === userImageUrl) return 'user';
  return 'catalog';
}

export function ProductImagePicker({
  candidates,
  selection,
  onChange,
  alt = 'Product',
  emptyMessage = 'No image found online — upload your own',
  readOnly = false,
}: ProductImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  const allCandidates = dedupeCandidates(candidates);
  const selectedUrls = dedupeUrls(selection.selectedUrls);
  const selectedIndex = new Map(selectedUrls.map((url, index) => [url, index]));
  const selectedCount = selectedUrls.length;
  const heroUrl = selectedCount > 0 ? selectedUrls[Math.min(slideIndex, selectedCount - 1)] : null;

  useEffect(() => {
    if (selectedCount === 0) {
      setSlideIndex(0);
      return;
    }
    setSlideIndex(current => Math.min(current, selectedCount - 1));
  }, [selectedCount]);

  const emitSelection = (urls: string[], userImageUrl = selection.userImageUrl) => {
    const nextUrls = dedupeUrls(urls);
    onChange({
      selectedUrls: nextUrls,
      userImageUrl,
      preferredImageSource: preferredSourceForUrls(nextUrls, allCandidates, userImageUrl),
    });
  };

  const toggleCandidate = (url: string, isUser: boolean) => {
    const index = selectedIndex.get(url);
    if (index != null) {
      const nextUrls = selectedUrls.filter(u => u !== url);
      emitSelection(nextUrls);
      if (nextUrls.length === 0) {
        setSlideIndex(0);
      } else if (selectedUrls[slideIndex] === url) {
        setSlideIndex(Math.min(slideIndex, nextUrls.length - 1));
      } else if (index < slideIndex) {
        setSlideIndex(slideIndex - 1);
      }
      return;
    }

    const nextUserImageUrl = isUser ? url : selection.userImageUrl;
    const nextUrls = [...selectedUrls, url];
    emitSelection(nextUrls, nextUserImageUrl);
    setSlideIndex(nextUrls.length - 1);
  };

  const handleThumbClick = (url: string) => {
    const index = selectedIndex.get(url);
    if (index == null) return;
    setSlideIndex(index);
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const invalid = files.find(file => !file.type.startsWith('image/'));
    if (invalid) {
      toast.error('Please choose image files only.');
      return;
    }

    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        uploaded.push(await uploadProductImage(file));
      }
      const lastUpload = uploaded[uploaded.length - 1];
      const nextUrls = [...selectedUrls, ...uploaded];
      emitSelection(nextUrls, lastUpload ?? selection.userImageUrl);
      setSlideIndex(nextUrls.length - 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const goPrev = () => {
    if (selectedCount < 2) return;
    setSlideIndex(current => (current - 1 + selectedCount) % selectedCount);
  };

  const goNext = () => {
    if (selectedCount < 2) return;
    setSlideIndex(current => (current + 1) % selectedCount);
  };

  return (
    <section className="product-image-picker" aria-label="Listing images">
      {heroUrl ? (
        <div className="product-image-picker-hero">
          <div className="product-image-picker-hero-stage">
            {selectedCount > 1 && (
              <button
                type="button"
                className="product-image-picker-nav product-image-picker-nav--prev"
                onClick={goPrev}
                aria-label="Previous selected image"
              >
                ‹
              </button>
            )}
            <img src={heroUrl} alt={alt} className="photo-review-hero-image" />
            {selectedCount > 1 && (
              <button
                type="button"
                className="product-image-picker-nav product-image-picker-nav--next"
                onClick={goNext}
                aria-label="Next selected image"
              >
                ›
              </button>
            )}
          </div>
          <span className="product-image-picker-hero-count">
            {selectedCount > 1
              ? `${slideIndex + 1} / ${selectedCount} · first selected is cover`
              : '1 image selected · cover'}
          </span>
        </div>
      ) : allCandidates.length > 0 ? (
        <div className="product-image-picker-empty">
          <p>Check images below to build your listing slideshow.</p>
        </div>
      ) : (
        <div className="product-image-picker-empty">
          <span className="product-image-picker-empty-icon" aria-hidden="true">📷</span>
          <p>{emptyMessage}</p>
        </div>
      )}

      {allCandidates.length > 0 && !readOnly && (
        <div className="product-image-picker-candidates">
          <span className="product-image-picker-label">Choose images</span>
          <p className="product-image-picker-hint">
            Check to add. Click a selected thumbnail to preview it. Selection order is slideshow
            order — first is the cover.
          </p>
          <div className="product-image-picker-grid">
            {allCandidates.map(candidate => {
              const order = selectedIndex.get(candidate.url);
              const isSelected = order != null;
              const isViewing = isSelected && selectedUrls[slideIndex] === candidate.url;
              const isUser = candidate.source === 'user_upload' || candidate.source === 'user_photo';
              return (
                <div
                  key={candidate.url}
                  className={[
                    'product-image-picker-thumb',
                    isSelected ? 'product-image-picker-thumb--active' : '',
                    isViewing ? 'product-image-picker-thumb--viewing' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <label className="product-image-picker-thumb-check">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCandidate(candidate.url, isUser)}
                      aria-label={
                        isSelected
                          ? `Remove image ${order + 1} from selection`
                          : `Add image from ${getImageSourceLabel(candidate.source)}`
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="product-image-picker-thumb-preview"
                    onClick={() => handleThumbClick(candidate.url)}
                    disabled={!isSelected}
                    title={
                      isSelected
                        ? `Preview image ${order + 1}`
                        : 'Check this image to add it to the slideshow'
                    }
                    aria-label={
                      isSelected
                        ? `Preview selected image ${order + 1}`
                        : `Image not selected — use checkbox to add`
                    }
                  >
                    <img src={candidate.url} alt="" />
                    {isSelected && (
                      <span className="product-image-picker-thumb-order" aria-hidden="true">
                        {order + 1}
                      </span>
                    )}
                    <span className="product-image-picker-thumb-badge">
                      {getImageSourceLabel(candidate.source)}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="product-image-picker-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleUpload}
          />
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : selectedCount > 0 ? 'Upload more images' : 'Upload your own'}
          </button>
        </div>
      )}
    </section>
  );
}
