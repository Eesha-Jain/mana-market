'use client';

import './page.css';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { useToast } from '@/contexts/ToastContext';
import { TEXT_CASE_OPTIONS, applyTextCase, type TextCaseFormat } from '@/utils/settings';
import {
  PHOTO_CAPTURE_TARGET_OPTIONS,
  PRICING_MODE_OPTIONS,
  MARKET_PRICE_PREFERENCE_OPTIONS,
  resolveDescriptionCase,
  resolveMarketPricePreference,
  resolvePercentBelow,
  resolvePricingMode,
  resolveTitleCase,
  type PhotoCaptureTarget,
} from '@/utils/settings';
import type { MarketPricePreference, MarketplaceConnection, MarketplacePlatform, PricingMode } from '@/types';
import { MARKETPLACE_LABELS, MARKETPLACE_PLATFORMS } from '@/types';
import { formatPrice } from '@/utils/search';
import { getAccessToken } from '@/lib/supabase/client';
import {
  connectGuidedMarketplaceAction,
  getEbayOAuthStartUrlAction,
} from '@/lib/marketplaces/actions';
import {
  disconnectMarketplaceAction,
  fetchMarketplaceConnectionsAction,
} from '@/lib/inventory/actions';
import { GuidedMarketplaceModal } from '@/components/settings/GuidedMarketplaceModal';

const CASE_PREVIEW = 'modern horizons 3 booster box';
const SAMPLE_MARKET = 289.99;

function CasePreview({ format }: { format: TextCaseFormat }) {
  if (format === 'as_detected') {
    return <span className="settings-preview-text settings-preview-text--muted">{CASE_PREVIEW}</span>;
  }
  return (
    <span className="settings-preview-text">{applyTextCase(CASE_PREVIEW, format)}</span>
  );
}

function PricingPreview({
  mode,
  percentBelow,
}: {
  mode: PricingMode;
  percentBelow: number;
}) {
  if (mode === 'manual') {
    return <span className="settings-preview-text settings-preview-text--muted">You set the price on each listing</span>;
  }
  if (mode === 'percent_below') {
    const price = Math.round(SAMPLE_MARKET * (1 - percentBelow / 100) * 100) / 100;
    return (
      <span className="settings-preview-text">
        {formatPrice(SAMPLE_MARKET)} market → {formatPrice(price)} ({percentBelow}% off)
      </span>
    );
  }
  return (
    <span className="settings-preview-text">
      {formatPrice(SAMPLE_MARKET)} (matches current market price)
    </span>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="page"><p className="text-muted-sm">Loading settings…</p></div>}>
      <SettingsPage />
    </Suspense>
  );
}

function SettingsPage() {
  const { settings, updateSettings } = useUserSettings();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<MarketplaceConnection[]>([]);
  const [connecting, setConnecting] = useState<MarketplacePlatform | null>(null);
  const [guidedPlatform, setGuidedPlatform] = useState<'tcgplayer' | 'facebook' | null>(null);

  const loadConnections = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const rows = await fetchMarketplaceConnectionsAction(token);
      setConnections(rows);
    } catch {
      // ignore when offline
    }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const oauthError = searchParams.get('oauth_error');
    if (connected === 'ebay') {
      toast.success('Connected eBay');
      void loadConnections();
      window.history.replaceState({}, '', '/settings');
    } else if (oauthError) {
      toast.error(`eBay connection failed: ${oauthError}`);
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams, toast, loadConnections]);

  const handleConnect = async (platform: MarketplacePlatform) => {
    setConnecting(platform);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');

      if (platform === 'ebay') {
        const authUrl = await getEbayOAuthStartUrlAction(token);
        window.location.href = authUrl;
        return;
      }

      if (platform === 'tcgplayer' || platform === 'facebook') {
        setGuidedPlatform(platform);
        return;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(null);
    }
  };

  const handleGuidedConfirm = async (input: { sellerUrl?: string; sellerName?: string }) => {
    if (!guidedPlatform) return;
    const token = await getAccessToken();
    if (!token) throw new Error('Not signed in');
    await connectGuidedMarketplaceAction(token, guidedPlatform, input);
    await loadConnections();
    toast.success(`Enabled ${MARKETPLACE_LABELS[guidedPlatform]}`);
    setGuidedPlatform(null);
  };

  const handleDisconnect = async (platform: MarketplacePlatform) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      await disconnectMarketplaceAction(token, platform);
      setConnections(prev => prev.filter(c => c.platform !== platform));
      toast.success(`Disconnected ${MARKETPLACE_LABELS[platform]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Disconnect failed');
    }
  };

  const getConnectionStatus = (platform: MarketplacePlatform, connection?: MarketplaceConnection) => {
    if (!connection) return 'Not connected';
    if (platform === 'ebay') {
      if (!connection.isHealthy) return 'Needs reconnect';
      return connection.accountLabel ? `Connected as ${connection.accountLabel}` : 'Connected';
    }
    if (connection.metadata?.connectionType === 'guided' || platform === 'facebook' || platform === 'tcgplayer') {
      const name = connection.metadata?.sellerName as string | undefined;
      return name ? `Guided setup · ${name}` : 'Guided setup enabled';
    }
    return connection.accountLabel ? `Connected as ${connection.accountLabel}` : 'Connected';
  };

  const getConnectLabel = (platform: MarketplacePlatform) => {
    if (platform === 'ebay') return 'Connect';
    if (platform === 'facebook') return 'Enable';
    return 'Set up';
  };

  const titleCase = resolveTitleCase(settings);
  const descriptionCase = resolveDescriptionCase(settings);
  const pricingMode = resolvePricingMode(settings);
  const percentBelow = resolvePercentBelow(settings);
  const marketPricePreference = resolveMarketPricePreference(settings);

  const updateTitleCase = (value: TextCaseFormat) => {
    updateSettings({ titleCase: value });
  };

  const updateDescriptionCase = (value: TextCaseFormat) => {
    updateSettings({ descriptionCase: value });
  };

  const updatePricingMode = (value: PricingMode) => {
    updateSettings({ pricingMode: value });
  };

  const updatePercentBelow = (value: number) => {
    updateSettings({ percentBelow: value });
  };

  const updateMarketPricePreference = (value: MarketPricePreference) => {
    updateSettings({ marketPricePreference: value });
  };

  const updatePhotoCaptureTarget = (value: string) => {
    updateSettings({
      photoCaptureTarget: value ? (value as PhotoCaptureTarget) : null,
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Defaults apply when you review new uploads and photo scans.
            You can still override any field on each listing.
          </p>
        </div>
      </div>

      <div className="settings-layout">
        <section className="settings-panel">
          <div className="settings-panel-head">
            <span className="settings-panel-icon" aria-hidden="true">Aa</span>
            <div>
              <h2 className="settings-panel-title">Text capitalization</h2>
              <p className="settings-panel-desc">
                Choose how scanned label text is formatted before you review it.
              </p>
            </div>
          </div>

          <div className="settings-field-grid">
            <label className="settings-field-card">
              <span className="settings-field-label">Default title format</span>
              <select
                className="detail-input settings-field-input"
                value={titleCase}
                onChange={e => updateTitleCase(e.target.value as TextCaseFormat)}
              >
                {TEXT_CASE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="settings-field-preview">
                <span className="settings-preview-label">Preview</span>
                <CasePreview format={titleCase} />
              </div>
            </label>

            <label className="settings-field-card">
              <span className="settings-field-label">Default description format</span>
              <select
                className="detail-input settings-field-input"
                value={descriptionCase}
                onChange={e => updateDescriptionCase(e.target.value as TextCaseFormat)}
              >
                {TEXT_CASE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="settings-field-preview">
                <span className="settings-preview-label">Preview</span>
                <CasePreview format={descriptionCase} />
              </div>
            </label>
          </div>

          <p className="settings-footnote">
            These defaults apply automatically when you review uploads and photo scans.
          </p>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-head">
            <span className="settings-panel-icon" aria-hidden="true">$</span>
            <div>
              <h2 className="settings-panel-title">Default pricing</h2>
              <p className="settings-panel-desc">
                Pre-selects pricing when you add items from upload or photo scan.
              </p>
            </div>
          </div>

          <div className="settings-field-grid">
            <label className="settings-field-card">
              <span className="settings-field-label">Default pricing mode</span>
              <select
                className="detail-input settings-field-input"
                value={pricingMode}
                onChange={e => updatePricingMode(e.target.value as PricingMode)}
              >
                {PRICING_MODE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            {pricingMode === 'percent_below' && (
              <label className="settings-field-card">
                <span className="settings-field-label">Default discount below market</span>
                <div className="settings-percent-row">
                  <input
                    type="number"
                    className="detail-input settings-field-input"
                    min={1}
                    max={99}
                    value={percentBelow}
                    onChange={e =>
                      updatePercentBelow(
                        Math.min(
                          99,
                          Math.max(1, parseInt(e.target.value, 10) || percentBelow),
                        ),
                      )
                    }
                  />
                  <span className="settings-percent-suffix">%</span>
                </div>
              </label>
            )}

            <label className="settings-field-card">
              <span className="settings-field-label">Default market price source</span>
              <select
                className="detail-input settings-field-input"
                value={marketPricePreference}
                onChange={e => updateMarketPricePreference(e.target.value as MarketPricePreference)}
              >
                {MARKET_PRICE_PREFERENCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="settings-field-preview">
                <span className="settings-preview-label">About</span>
                <span className="settings-preview-text settings-preview-text--muted">
                  {MARKET_PRICE_PREFERENCE_OPTIONS.find(o => o.value === marketPricePreference)?.description}
                </span>
              </div>
              <p className="settings-footnote" style={{ marginTop: '0.75rem' }}>
                Tip: choose <strong>Show all</strong> to pick Amazon or a specific UPC store
                (eBay, Walmart, …) on each item. That choice also drives % below market.
              </p>
            </label>
          </div>

          <div className="settings-field-preview settings-field-preview--block">
            <span className="settings-preview-label">Preview (sample ${SAMPLE_MARKET} item)</span>
            <PricingPreview mode={pricingMode} percentBelow={percentBelow} />
          </div>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-head">
            <span className="settings-panel-icon" aria-hidden="true">📷</span>
            <div>
              <h2 className="settings-panel-title">Photo scan defaults</h2>
              <p className="settings-panel-desc">
                Choose what to photograph by default. Leave unset to pick each time until you save a default.
              </p>
            </div>
          </div>

          <label className="settings-field-card">
            <span className="settings-field-label">Default photo type</span>
            <select
              className="detail-input settings-field-input"
              value={settings.photoCaptureTarget ?? ''}
              onChange={e => updatePhotoCaptureTarget(e.target.value)}
            >
              <option value="">Ask each time</option>
              {PHOTO_CAPTURE_TARGET_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}{opt.recommended ? ' (recommended)' : ''}
                </option>
              ))}
            </select>
            <div className="settings-field-preview">
              <span className="settings-preview-label">Tip</span>
              <span className="settings-preview-text settings-preview-text--muted">
                UPC barcodes are the black-and-white lines with numbers underneath — most reliable for lookup.
              </span>
            </div>
          </label>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-head">
            <span className="settings-panel-icon" aria-hidden="true">🌐</span>
            <div>
              <h2 className="settings-panel-title">Connected marketplaces</h2>
              <p className="settings-panel-desc">
                Link your seller accounts to list items and refresh sold status. Facebook uses a guided listing flow.
              </p>
            </div>
          </div>

          <div className="settings-marketplace-list">
            {MARKETPLACE_PLATFORMS.map(platform => {
              const connection = connections.find(c => c.platform === platform);
              const isConnected = !!connection;
              return (
                <div key={platform} className="settings-marketplace-row organic-panel">
                  <div>
                    <strong>{MARKETPLACE_LABELS[platform]}</strong>
                    <p className="text-muted-sm">
                      {getConnectionStatus(platform, connection)}
                    </p>
                    {platform !== 'ebay' && isConnected && (
                      <span className="settings-marketplace-badge">Guided</span>
                    )}
                  </div>
                  {isConnected ? (
                    platform === 'ebay' && !connection?.isHealthy ? (
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        disabled={connecting === platform}
                        onClick={() => void handleConnect(platform)}
                      >
                        Reconnect
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => void handleDisconnect(platform)}
                      >
                        Disconnect
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={connecting === platform}
                      onClick={() => void handleConnect(platform)}
                    >
                      {connecting === platform ? 'Connecting…' : getConnectLabel(platform)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {guidedPlatform && (
        <GuidedMarketplaceModal
          platform={guidedPlatform}
          onClose={() => setGuidedPlatform(null)}
          onConfirm={handleGuidedConfirm}
        />
      )}
    </div>
  );
}
