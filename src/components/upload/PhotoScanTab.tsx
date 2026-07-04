'use client';

import { useState, useRef, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useItems } from '@/contexts/ItemsContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { buildPhotoReviewData } from '@/utils/photoReview';
import { persistPhotoScanImage } from '@/utils/imageUpload';
import { ProductReviewFlow } from '@/components/review/ProductReviewFlow';
import { PhotoCaptureTargetSelector } from './PhotoCaptureTargetSelector';
import { SaveDefaultPrompt, type DefaultSaveOffer } from '@/components/ui/SaveDefaultPrompt';
import type { ProductReviewConfirmPayload, ProductReviewData } from '@/utils/productReview';
import type { EbayCondition } from '@/types';
import {
  describePhotoCaptureTarget,
  settingLabel,
  type PhotoCaptureTarget,
} from '@/utils/userSettings';

interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|avif)$/i;

function newPhotoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isImageFile(file: File): boolean {
  if (!file.type) return true;
  if (file.type.startsWith('image/')) return true;
  return IMAGE_EXT.test(file.name);
}

function addPendingFiles(files: FileList | File[], existing: PendingPhoto[]): PendingPhoto[] {
  const seen = new Set(existing.map(p => `${p.file.name}-${p.file.size}-${p.file.lastModified}`));
  const added: PendingPhoto[] = [];

  for (const file of files) {
    if (!isImageFile(file)) continue;
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    added.push({
      id: newPhotoId(),
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  return [...existing, ...added];
}

function revokePendingPhotos(photos: PendingPhoto[]) {
  for (const photo of photos) {
    URL.revokeObjectURL(photo.previewUrl);
  }
}

export function PhotoScanTab() {
  const { addItem, items } = useItems();
  const {
    defaultPhotoCaptureTarget,
    isDefaultConfigured,
    saveConfiguredDefault,
  } = useUserSettings();
  const router = useRouter();
  const singleFileRef = useRef<HTMLInputElement>(null);
  const singleCameraRef = useRef<HTMLInputElement>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const bulkCameraRef = useRef<HTMLInputElement>(null);

  const [scanMode, setScanMode] = useState<'single' | 'bulk'>('single');
  const [sessionCaptureTarget, setSessionCaptureTarget] = useState<PhotoCaptureTarget | null>(null);
  const [captureTargetError, setCaptureTargetError] = useState('');
  const [pendingSaveOffer, setPendingSaveOffer] = useState<DefaultSaveOffer | null>(null);
  const [pendingSaveTarget, setPendingSaveTarget] = useState<PhotoCaptureTarget | null>(null);

  const photoTargetConfigured = isDefaultConfigured('photoCaptureTarget');
  const effectiveCaptureTarget = sessionCaptureTarget ?? defaultPhotoCaptureTarget;
  const requirePhotoTargetSelection = !photoTargetConfigured && !sessionCaptureTarget;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [reviewData, setReviewData] = useState<ProductReviewData | null>(null);

  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkIndex, setBulkIndex] = useState(0);
  const [bulkFileError, setBulkFileError] = useState('');

  const pendingPhotosRef = useRef(pendingPhotos);
  const bulkIndexRef = useRef(bulkIndex);
  const bulkProcessingRef = useRef(bulkProcessing);
  const activeBulkQueueRef = useRef<PendingPhoto[]>([]);
  const bulkRunIdRef = useRef(0);
  const singleRunIdRef = useRef(0);
  const batchConditionPrefillRef = useRef<EbayCondition | null>(null);
  const currentPhotoFileRef = useRef<File | null>(null);
  pendingPhotosRef.current = pendingPhotos;
  bulkIndexRef.current = bulkIndex;
  bulkProcessingRef.current = bulkProcessing;

  const resetSingle = () => {
    singleRunIdRef.current += 1;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setReviewData(null);
    setScanning(false);
  };

  const resetBulk = () => {
    batchConditionPrefillRef.current = null;
    bulkRunIdRef.current += 1;
    revokePendingPhotos(pendingPhotos);
    revokePendingPhotos(activeBulkQueueRef.current);
    activeBulkQueueRef.current = [];
    bulkProcessingRef.current = false;
    setPendingPhotos([]);
    setBulkProcessing(false);
    setBulkIndex(0);
    setReviewData(null);
    setScanning(false);
    setBulkFileError('');
  };

  const resetAll = () => {
    resetSingle();
    resetBulk();
  };

  const handleCaptureTargetChange = (target: PhotoCaptureTarget) => {
    setCaptureTargetError('');
    setSessionCaptureTarget(target);

    if (!photoTargetConfigured) {
      setPendingSaveTarget(target);
      setPendingSaveOffer({
        key: 'photoCaptureTarget',
        label: settingLabel('photoCaptureTarget'),
        description: describePhotoCaptureTarget(target),
      });
    }
  };

  const ensureCaptureTarget = (): PhotoCaptureTarget | null => {
    if (effectiveCaptureTarget) return effectiveCaptureTarget;
    setCaptureTargetError('Choose what you are photographing before taking a photo.');
    return null;
  };

  const handleSaveDefaultConfirm = () => {
    if (pendingSaveTarget) {
      saveConfiguredDefault({ defaultPhotoCaptureTarget: pendingSaveTarget }, 'photoCaptureTarget');
    }
    setPendingSaveOffer(null);
    setPendingSaveTarget(null);
  };

  const handleSaveDefaultDecline = () => {
    setPendingSaveOffer(null);
    setPendingSaveTarget(null);
  };

  const captureHint =
    effectiveCaptureTarget === 'upc'
      ? 'Point at the UPC barcode — the black lines with numbers underneath.'
      : effectiveCaptureTarget === 'label'
        ? 'Point at the product label on the front — we will read the text for you to review.'
        : 'Choose what you are photographing above, then take a photo.';

  const handleApplyConditionToRemaining = (condition: EbayCondition) => {
    batchConditionPrefillRef.current = condition;
  };

  const applyBatchConditionPrefill = (data: ProductReviewData): ProductReviewData => {
    const prefill = batchConditionPrefillRef.current;
    if (!data.initialCondition && prefill) {
      return { ...data, initialCondition: prefill };
    }
    return data;
  };

  const queueItem = async (payload: ProductReviewConfirmPayload) => {
    let photoUrl = payload.photoUrl;
    let userImageUrl = payload.userImageUrl;
    let preferredImageSource = payload.preferredImageSource;

    try {
      const persisted = await persistPhotoScanImage(photoUrl, currentPhotoFileRef.current ?? undefined);
      if (persisted.photoUrl) photoUrl = persisted.photoUrl;
      if (persisted.userImageUrl) userImageUrl = persisted.userImageUrl;
      if (persisted.preferredImageSource) preferredImageSource = persisted.preferredImageSource;
    } catch {
      // Local blob kept for in-app preview when upload is unavailable.
    }

    addItem(payload.query, 'photo', {
      photoUrl,
      userImageUrl,
      preferredImageSource,
      quantity: payload.quantity,
      condition: payload.condition,
      pricingMode: payload.pricingMode,
      percentBelow: payload.percentBelow,
      manualPrice: payload.manualPrice,
      marketPricePreference: payload.marketPricePreference,
      selectedMarketPriceSource: payload.selectedMarketPriceSource,
      notes: payload.notes,
      customTitle: payload.customTitle,
      customDescription: payload.customDescription,
      detectedProductType: payload.parseMeta?.packType,
      detectedCardCount: payload.parseMeta?.cardCount,
      status: payload.product ? 'found' : 'not_found',
      product: payload.product,
    });
  };

  const processSingleImage = async (file: File) => {
    const captureTarget = ensureCaptureTarget();
    if (!captureTarget) return;

    resetSingle();
    const runId = ++singleRunIdRef.current;
    setScanning(true);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    currentPhotoFileRef.current = file;

    try {
      const data = applyBatchConditionPrefill(
        await buildPhotoReviewData(file, objectUrl, { captureTarget }),
      );
      if (runId !== singleRunIdRef.current) return;
      setReviewData(data);
    } finally {
      if (runId === singleRunIdRef.current) {
        setScanning(false);
      }
    }
  };

  const finishBulkQueue = () => {
    const photos = activeBulkQueueRef.current;
    bulkRunIdRef.current += 1;
    revokePendingPhotos(photos);
    activeBulkQueueRef.current = [];
    bulkProcessingRef.current = false;
    setPendingPhotos([]);
    setBulkProcessing(false);
    setBulkIndex(0);
    setReviewData(null);
    setScanning(false);
  };

  const processBulkPhotoAt = async (index: number, photos: PendingPhoto[]) => {
    if (index >= photos.length) {
      finishBulkQueue();
      return;
    }

    const captureTarget = ensureCaptureTarget();
    if (!captureTarget) {
      finishBulkQueue();
      return;
    }

    const runId = ++bulkRunIdRef.current;

    setBulkIndex(index);
    setReviewData(null);
    setScanning(true);

    const photo = photos[index]!;
    currentPhotoFileRef.current = photo.file;
    try {
      const data = applyBatchConditionPrefill(
        await buildPhotoReviewData(photo.file, photo.previewUrl, { captureTarget }),
      );
      if (runId !== bulkRunIdRef.current) return;
      setReviewData(data);
    } catch (err) {
      if (runId !== bulkRunIdRef.current) return;
      const message = err instanceof Error ? err.message : 'Photo scan failed.';
      setReviewData(applyBatchConditionPrefill({
        variant: 'photo',
        searchQuery: '',
        photoUrl: photo.previewUrl,
        readableLines: [],
        matchedProduct: null,
        suggestedProduct: null,
        ambiguousResults: null,
        scanError: message,
        initialQuantity: 1,
        initialCondition: null,
        initialPricingMode: 'market',
        initialPercentBelow: 10,
        initialManualPrice: 0,
        source: 'photo',
      }));
    } finally {
      if (runId === bulkRunIdRef.current) {
        setScanning(false);
      }
    }
  };

  const startBulkReview = (photos = pendingPhotosRef.current) => {
    if (!photos.length || bulkProcessingRef.current) return;
    if (!ensureCaptureTarget()) return;

    batchConditionPrefillRef.current = null;
    activeBulkQueueRef.current = photos;
    bulkProcessingRef.current = true;
    setBulkProcessing(true);
    setBulkIndex(0);
    setBulkFileError('');
    void processBulkPhotoAt(0, photos);
  };

  const advanceBulk = () => {
    void processBulkPhotoAt(bulkIndexRef.current + 1, activeBulkQueueRef.current);
  };

  const handleConfirmReview = async (payload: ProductReviewConfirmPayload) => {
    await queueItem(payload);

    if (bulkProcessingRef.current) {
      setReviewData(null);
      advanceBulk();
      return;
    }

    resetSingle();
  };

  const handleCloseReview = () => {
    if (bulkProcessingRef.current) {
      setReviewData(null);
      advanceBulk();
      return;
    }

    resetSingle();
  };

  const handleExitToReview = () => {
    if (bulkProcessingRef.current) {
      finishBulkQueue();
    } else {
      resetSingle();
    }
    router.push('/review');
  };

  const handleCancelBatch = () => {
    if (bulkProcessingRef.current) {
      finishBulkQueue();
      return;
    }

    resetSingle();
  };

  const handleSingleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = Array.from(e.currentTarget.files ?? [])[0];
    e.currentTarget.value = '';
    if (file && isImageFile(file)) processSingleImage(file);
  };

  const handleBulkFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.currentTarget.files ?? []);
    e.currentTarget.value = '';
    if (!picked.length) return;

    const next = addPendingFiles(picked, pendingPhotosRef.current);

    if (next.length === pendingPhotosRef.current.length) {
      setBulkFileError('No image files were recognized. Try JPG, PNG, or HEIC.');
      return;
    }

    setBulkFileError('');
    setPendingPhotos(next);
  };

  const removePendingPhoto = (id: string) => {
    setBulkFileError('');
    setPendingPhotos(prev => {
      const target = prev.find(p => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(p => p.id !== id);
    });
  };

  const switchMode = (mode: 'single' | 'bulk') => {
    if (bulkProcessingRef.current || scanning || reviewData) return;
    resetAll();
    setScanMode(mode);
  };

  const queuePhotos = bulkProcessing ? activeBulkQueueRef.current : pendingPhotos;
  const bulkProgress = bulkProcessing && queuePhotos.length > 0
    ? {
        current: bulkIndex + 1,
        total: queuePhotos.length,
        remaining: queuePhotos.length - bulkIndex - 1,
      }
    : undefined;

  const showBulkCollecting = scanMode === 'bulk' && !bulkProcessing;
  const showBulkProcessing = scanMode === 'bulk' && bulkProcessing && !reviewData;
  const currentBulkPhoto = queuePhotos[bulkIndex];

  const openCamera = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (!ensureCaptureTarget()) return;
    ref.current?.click();
  };

  const scanningMessage =
    effectiveCaptureTarget === 'upc' ? 'Reading barcode…' : 'Reading label…';

  return (
    <div className="tab-content">
      <p className="tab-hint">
        Photograph product packaging to look up listings. UPC barcodes are the most reliable;
        front-label photos work too — Gemini reads the text for you to review.
      </p>

      <PhotoCaptureTargetSelector
        value={effectiveCaptureTarget}
        onChange={handleCaptureTargetChange}
        requireSelection={requirePhotoTargetSelection}
      />

      {captureTargetError && (
        <div className="form-error-banner photo-capture-target-error">{captureTargetError}</div>
      )}

      <div className="photo-scan-mode-bar">
        <button
          type="button"
          className={`photo-scan-mode-btn${scanMode === 'single' ? ' active' : ''}`}
          onClick={() => switchMode('single')}
          disabled={bulkProcessing}
        >
          📷 Single
        </button>
        <button
          type="button"
          className={`photo-scan-mode-btn${scanMode === 'bulk' ? ' active' : ''}`}
          onClick={() => switchMode('bulk')}
          disabled={bulkProcessing}
        >
          🖼️ Bulk
        </button>
      </div>

      {scanMode === 'bulk' && (
        <>
          <input
            ref={bulkFileRef}
            type="file"
            accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
            multiple
            className="sr-only"
            data-testid="bulk-library-input"
            onChange={handleBulkFiles}
          />
          <input
            ref={bulkCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handleBulkFiles}
          />
        </>
      )}

      {scanMode === 'single' && (
        <div className="photo-scan-area">
          {!previewUrl ? (
            <div className="photo-scan-actions">
              <div className="photo-scan-cta-row">
                <button
                  type="button"
                  className="photo-scan-cta photo-scan-cta--primary"
                  onClick={() => openCamera(singleCameraRef)}
                >
                  <span className="photo-scan-cta-icon">📸</span>
                  <span className="photo-scan-cta-label">Take photo</span>
                </button>
                <button
                  type="button"
                  className="photo-scan-cta"
                  onClick={() => {
                    if (!ensureCaptureTarget()) return;
                    singleFileRef.current?.click();
                  }}
                >
                  <span className="photo-scan-cta-icon">🖼️</span>
                  <span className="photo-scan-cta-label">Choose from library</span>
                </button>
              </div>
              <p className="text-muted text-sm photo-scan-cta-hint">{captureHint}</p>
              <input ref={singleFileRef} type="file" accept="image/*" className="sr-only" onChange={handleSingleFile} />
              <input ref={singleCameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleSingleFile} />
            </div>
          ) : (
            <div className="photo-scan-preview">
              <img src={previewUrl} alt="Product preview" className="photo-scan-image" />
              {scanning && (
                <div className="photo-scan-overlay">
                  <div className="spinner" />
                  <span>{scanningMessage}</span>
                  <button type="button" className="btn-ghost btn-sm photo-bulk-scan-cancel" onClick={handleCancelBatch}>
                    Cancel
                  </button>
                </div>
              )}
              {!scanning && !reviewData && (
                <button className="btn-ghost btn-sm photo-scan-retake" onClick={resetSingle}>
                  ↩ Retake / Choose different photo
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {showBulkCollecting && (
        <div className="photo-bulk-collect">
          <div className="photo-scan-actions">
            <div className="photo-scan-cta-row">
              <button
                type="button"
                className="photo-scan-cta photo-scan-cta--primary"
                onClick={() => openCamera(bulkCameraRef)}
              >
                <span className="photo-scan-cta-icon">📸</span>
                <span className="photo-scan-cta-label">Take photo</span>
              </button>
              <button
                type="button"
                className="photo-scan-cta"
                onClick={() => {
                  if (!ensureCaptureTarget()) return;
                  bulkFileRef.current?.click();
                }}
              >
                <span className="photo-scan-cta-icon">🖼️</span>
                <span className="photo-scan-cta-label">Add from library</span>
              </button>
            </div>
          </div>

          {bulkFileError && (
            <div className="form-error-banner">{bulkFileError}</div>
          )}

          {pendingPhotos.length > 0 ? (
            <>
              <div className="photo-bulk-grid">
                {pendingPhotos.map((photo, i) => (
                  <div key={photo.id} className="photo-bulk-thumb-wrap">
                    <img src={photo.previewUrl} alt={`Photo ${i + 1}`} className="photo-bulk-thumb" />
                    <span className="photo-bulk-thumb-index">{i + 1}</span>
                    <button
                      type="button"
                      className="photo-bulk-thumb-remove"
                      onClick={() => removePendingPhoto(photo.id)}
                      aria-label={`Remove photo ${i + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="photo-bulk-actions">
                <button type="button" className="btn-ghost photo-bulk-clear" onClick={resetBulk}>
                  Clear all
                </button>
                <button type="button" className="btn-primary photo-bulk-done" onClick={() => startBulkReview()}>
                  Done — review {pendingPhotos.length} photo{pendingPhotos.length !== 1 ? 's' : ''}
                </button>
              </div>
            </>
          ) : (
            <p className="text-muted text-sm photo-bulk-empty">
              Add photos with the camera or pick several from your library, then click Done to review each one.
            </p>
          )}
        </div>
      )}

      {bulkProcessing && bulkProgress && (
        <div className="photo-batch-progress-banner photo-batch-progress-banner--interactive" role="status" aria-live="polite">
          <span className="photo-batch-progress-count">
            Photo {bulkProgress.current} of {bulkProgress.total}
          </span>
          {bulkProgress.remaining > 0 ? (
            <span className="photo-batch-progress-remaining">
              {bulkProgress.remaining} left after this one
            </span>
          ) : (
            <span className="photo-batch-progress-remaining">Last photo</span>
          )}
          <div className="batch-exit-actions">
            {items.length > 0 && (
              <button type="button" className="btn-link btn-sm" onClick={handleExitToReview}>
                Review all →
              </button>
            )}
            <button type="button" className="btn-link btn-sm batch-exit-cancel" onClick={handleCancelBatch}>
              Cancel upload
            </button>
          </div>
        </div>
      )}

      {showBulkProcessing && (
        <div className="photo-bulk-processing">
          <div className="photo-scan-preview">
            {currentBulkPhoto && (
              <img
                src={currentBulkPhoto.previewUrl}
                alt={`Photo ${(bulkProgress?.current ?? bulkIndex + 1)}`}
                className="photo-scan-image"
              />
            )}
            <div className="photo-scan-overlay">
              <div className="spinner" />
              <span>
                {scanningMessage.replace('…', '')} photo {bulkProgress?.current ?? bulkIndex + 1}
                {bulkProgress ? ` of ${bulkProgress.total}` : ''}…
              </span>
              <button type="button" className="btn-ghost btn-sm photo-bulk-scan-cancel" onClick={handleCancelBatch}>
                Cancel upload
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewData && (
        <ProductReviewFlow
          key={bulkProcessing ? `${bulkIndex}-${reviewData.photoUrl}` : reviewData.photoUrl}
          data={reviewData}
          onConfirm={handleConfirmReview}
          onClose={handleCloseReview}
          onExitToReview={handleExitToReview}
          onCancelBatch={handleCancelBatch}
          queuedItemCount={items.length}
          batchProgress={bulkProgress}
          onApplyConditionToRemaining={handleApplyConditionToRemaining}
        />
      )}

      {pendingSaveOffer && (
        <SaveDefaultPrompt
          offers={[pendingSaveOffer]}
          onConfirm={handleSaveDefaultConfirm}
          onDecline={handleSaveDefaultDecline}
        />
      )}
    </div>
  );
}
