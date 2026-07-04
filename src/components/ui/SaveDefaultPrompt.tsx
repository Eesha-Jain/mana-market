'use client';

import type { DefaultSaveOffer } from '@/utils/reviewDefaults';
export type { DefaultSaveOffer } from '@/utils/reviewDefaults';

interface SaveDefaultPromptProps {
  offers: DefaultSaveOffer[];
  onConfirm: () => void;
  onDecline: () => void;
}

export function SaveDefaultPrompt({ offers, onConfirm, onDecline }: SaveDefaultPromptProps) {
  if (!offers.length) return null;

  const single = offers.length === 1;

  return (
    <div className="save-default-overlay" role="dialog" aria-modal="true" aria-labelledby="save-default-title">
      <div className="save-default-dialog">
        <h3 id="save-default-title" className="save-default-title">
          {single ? 'Save as your default?' : 'Save these as your defaults?'}
        </h3>
        <p className="save-default-subtitle">
          {single
            ? 'You can change this anytime in Settings.'
            : 'These will apply to future uploads and photo scans. You can change them anytime in Settings.'}
        </p>
        <ul className="save-default-list">
          {offers.map(offer => (
            <li key={offer.key} className="save-default-item">
              <span className="save-default-item-label">{offer.label}</span>
              <span className="save-default-item-value">{offer.description}</span>
            </li>
          ))}
        </ul>
        <div className="save-default-actions">
          <button type="button" className="btn-ghost" onClick={onDecline}>
            No
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            Yes, save {single ? 'default' : 'defaults'}
          </button>
        </div>
      </div>
    </div>
  );
}
