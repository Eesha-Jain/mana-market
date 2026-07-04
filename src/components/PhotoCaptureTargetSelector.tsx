'use client';

import {
  PHOTO_CAPTURE_TARGET_OPTIONS,
  type PhotoCaptureTarget,
} from '../utils/userSettings';

interface PhotoCaptureTargetSelectorProps {
  value: PhotoCaptureTarget | null;
  onChange: (target: PhotoCaptureTarget) => void;
  /** When true, user must pick before taking a photo. */
  requireSelection?: boolean;
  compact?: boolean;
}

export function PhotoCaptureTargetSelector({
  value,
  onChange,
  requireSelection = false,
  compact = false,
}: PhotoCaptureTargetSelectorProps) {
  return (
    <div
      className={`photo-capture-target${compact ? ' photo-capture-target--compact' : ''}${requireSelection && !value ? ' photo-capture-target--required' : ''}`}
      role="radiogroup"
      aria-label="What to photograph"
      aria-required={requireSelection}
    >
      {!compact && (
        <div className="photo-capture-target-head">
          <span className="photo-capture-target-heading">What are you photographing?</span>
          {requireSelection && !value && (
            <span className="photo-capture-target-required-hint">Choose one to continue</span>
          )}
        </div>
      )}

      <div className="photo-capture-target-options">
        {PHOTO_CAPTURE_TARGET_OPTIONS.map(option => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`photo-capture-target-option${selected ? ' photo-capture-target-option--selected' : ''}${option.recommended ? ' photo-capture-target-option--recommended' : ''}`}
              onClick={() => onChange(option.value)}
            >
              <div className="photo-capture-target-option-head">
                <span className="photo-capture-target-option-label">{option.label}</span>
                {option.recommended && (
                  <span className="photo-capture-target-badge">Recommended</span>
                )}
              </div>
              {!compact && (
                <p className="photo-capture-target-option-desc">{option.description}</p>
              )}
              {option.value === 'upc' && !compact && (
                <div className="photo-capture-target-example" aria-hidden="true">
                  <span className="photo-capture-target-example-bars">
                    <span /><span /><span /><span /><span /><span /><span /><span />
                  </span>
                  <span className="photo-capture-target-example-digits">6 3025 123456</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
