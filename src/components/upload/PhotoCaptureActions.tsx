'use client';

interface PhotoCaptureActionsProps {
  onTakePhoto: () => void;
  onChooseLibrary: () => void;
  primaryLabel?: string;
  libraryLabel?: string;
  hint?: string;
}

export function PhotoCaptureActions({
  onTakePhoto,
  onChooseLibrary,
  primaryLabel = 'Take photo',
  libraryLabel = 'Choose from library',
  hint,
}: PhotoCaptureActionsProps) {
  return (
    <div className="photo-scan-actions">
      <div className="photo-scan-cta-row">
        <button
          type="button"
          className="photo-scan-cta photo-scan-cta--primary"
          onClick={onTakePhoto}
        >
          <span className="photo-scan-cta-icon">📸</span>
          <span className="photo-scan-cta-label">{primaryLabel}</span>
        </button>
        <button
          type="button"
          className="photo-scan-cta"
          onClick={onChooseLibrary}
        >
          <span className="photo-scan-cta-icon">🖼️</span>
          <span className="photo-scan-cta-label">{libraryLabel}</span>
        </button>
      </div>
      {hint && <p className="text-muted-sm photo-scan-cta-hint">{hint}</p>}
    </div>
  );
}
