import { useUserSettings } from '../contexts/UserSettingsContext';
import { TEXT_CASE_OPTIONS, applyTextCase, type TextCaseFormat } from '../utils/textCase';
import {
  PHOTO_CAPTURE_TARGET_OPTIONS,
  PRICING_MODE_OPTIONS,
  MARKET_PRICE_PREFERENCE_OPTIONS,
  type PhotoCaptureTarget,
} from '../utils/userSettings';
import type { MarketPricePreference, PricingMode } from '../types';
import { formatPrice } from '../utils/productApi';

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

export function SettingsPage() {
  const { settings, saveConfiguredDefault, clearConfiguredDefault } = useUserSettings();

  const updateTitleCase = (value: TextCaseFormat) => {
    saveConfiguredDefault({ defaultTitleCase: value }, 'titleCase');
  };

  const updateDescriptionCase = (value: TextCaseFormat) => {
    saveConfiguredDefault({ defaultDescriptionCase: value }, 'descriptionCase');
  };

  const updatePricingMode = (value: PricingMode) => {
    saveConfiguredDefault({ defaultPricingMode: value }, 'pricingMode');
  };

  const updatePercentBelow = (value: number) => {
    saveConfiguredDefault({ defaultPercentBelow: value }, 'percentBelow');
  };

  const updateMarketPricePreference = (value: MarketPricePreference) => {
    saveConfiguredDefault({ defaultMarketPricePreference: value }, 'marketPriceSource');
  };

  const updatePhotoCaptureTarget = (value: string) => {
    if (!value) {
      clearConfiguredDefault('photoCaptureTarget', { defaultPhotoCaptureTarget: null });
      return;
    }
    saveConfiguredDefault(
      { defaultPhotoCaptureTarget: value as PhotoCaptureTarget },
      'photoCaptureTarget',
    );
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
                value={settings.defaultTitleCase}
                onChange={e => updateTitleCase(e.target.value as typeof settings.defaultTitleCase)}
              >
                {TEXT_CASE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="settings-field-preview">
                <span className="settings-preview-label">Preview</span>
                <CasePreview format={settings.defaultTitleCase} />
              </div>
            </label>

            <label className="settings-field-card">
              <span className="settings-field-label">Default description format</span>
              <select
                className="detail-input settings-field-input"
                value={settings.defaultDescriptionCase}
                onChange={e =>
                  updateDescriptionCase(e.target.value as typeof settings.defaultDescriptionCase)
                }
              >
                {TEXT_CASE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="settings-field-preview">
                <span className="settings-preview-label">Preview</span>
                <CasePreview format={settings.defaultDescriptionCase} />
              </div>
            </label>
          </div>

          <p className="settings-footnote">
            Per-field buttons (<code>abc</code> · <code>Abc</code> · <code>Aa Bb</code> · <code>ABC</code>)
            appear on photo review and item detail forms.
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
                value={settings.defaultPricingMode}
                onChange={e => updatePricingMode(e.target.value as PricingMode)}
              >
                {PRICING_MODE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            {settings.defaultPricingMode === 'percent_below' && (
              <label className="settings-field-card">
                <span className="settings-field-label">Default discount below market</span>
                <div className="settings-percent-row">
                  <input
                    type="number"
                    className="detail-input settings-field-input"
                    min={1}
                    max={99}
                    value={settings.defaultPercentBelow}
                    onChange={e =>
                      updatePercentBelow(
                        Math.min(
                          99,
                          Math.max(1, parseInt(e.target.value, 10) || settings.defaultPercentBelow),
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
                value={settings.defaultMarketPricePreference}
                onChange={e => updateMarketPricePreference(e.target.value as MarketPricePreference)}
              >
                {MARKET_PRICE_PREFERENCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="settings-field-preview">
                <span className="settings-preview-label">About</span>
                <span className="settings-preview-text settings-preview-text--muted">
                  {MARKET_PRICE_PREFERENCE_OPTIONS.find(o => o.value === settings.defaultMarketPricePreference)?.description}
                </span>
              </div>
            </label>
          </div>

          <div className="settings-field-preview settings-field-preview--block">
            <span className="settings-preview-label">Preview (sample ${SAMPLE_MARKET} item)</span>
            <PricingPreview
              mode={settings.defaultPricingMode}
              percentBelow={settings.defaultPercentBelow}
            />
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
              value={settings.defaultPhotoCaptureTarget ?? ''}
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
      </div>
    </div>
  );
}
