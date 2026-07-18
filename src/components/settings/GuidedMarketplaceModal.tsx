'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { MARKETPLACE_LABELS } from '@/types';
import { TCGPLAYER_SELLER_PORTAL } from '@/lib/marketplaces/tcgplayer';

interface GuidedMarketplaceModalProps {
  platform: 'tcgplayer' | 'facebook';
  onClose: () => void;
  onConfirm: (input: { sellerUrl?: string; sellerName?: string }) => Promise<void>;
}

const COPY: Record<
  'tcgplayer' | 'facebook',
  { title: string; subtitle: string; steps: string[]; portalUrl?: string; portalLabel?: string }
> = {
  tcgplayer: {
    title: 'Set up TCGplayer',
    subtitle: 'TCGplayer does not offer public API access for new apps. Use guided listing instead.',
    steps: [
      'Export your inventory from Manage using the CSV export tool.',
      'Upload or list items in the TCGplayer Seller Portal.',
      'Optionally paste your seller store URL or name below so we can label your connection.',
    ],
    portalUrl: TCGPLAYER_SELLER_PORTAL,
    portalLabel: 'Open TCGplayer Seller Portal',
  },
  facebook: {
    title: 'Enable Facebook Marketplace',
    subtitle: 'Facebook has no public listing API for individual sellers. We use a guided flow instead.',
    steps: [
      'From Manage, select items and choose Facebook as a listing platform.',
      'We open Facebook Marketplace with your title and price pre-filled.',
      'Complete the listing on Facebook, then mark it live in the app.',
    ],
    portalUrl: 'https://www.facebook.com/marketplace/create/item',
    portalLabel: 'Open Facebook Marketplace',
  },
};

export function GuidedMarketplaceModal({ platform, onClose, onConfirm }: GuidedMarketplaceModalProps) {
  const [sellerUrl, setSellerUrl] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [saving, setSaving] = useState(false);

  const content = COPY[platform];

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm({
        sellerUrl: sellerUrl.trim() || undefined,
        sellerName: sellerName.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={content.title}
      subtitle={content.subtitle}
      onClose={onClose}
      bodyClassName="guided-marketplace-body"
    >
      <ol className="guided-marketplace-steps">
        {content.steps.map(step => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      {platform === 'tcgplayer' && (
        <div className="guided-marketplace-fields">
          <label className="guided-marketplace-field">
            <span>Seller store URL (optional)</span>
            <input
              type="url"
              className="detail-input"
              placeholder="https://store.tcgplayer.com/..."
              value={sellerUrl}
              onChange={e => setSellerUrl(e.target.value)}
            />
          </label>
          <label className="guided-marketplace-field">
            <span>Seller name (optional)</span>
            <input
              type="text"
              className="detail-input"
              placeholder="Your TCGplayer store name"
              value={sellerName}
              onChange={e => setSellerName(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="guided-marketplace-actions">
        {content.portalUrl && (
          <a
            href={content.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost btn-sm"
          >
            {content.portalLabel}
          </a>
        )}
        <button type="button" className="btn-ghost btn-sm" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="btn-primary btn-sm" onClick={() => void handleConfirm()} disabled={saving}>
          {saving ? 'Saving…' : `Enable ${MARKETPLACE_LABELS[platform]}`}
        </button>
      </div>
    </Modal>
  );
}
