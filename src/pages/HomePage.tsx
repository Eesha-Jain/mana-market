import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { BrandWordmark } from '../components/BrandWordmark';
import { DragonHeroScene } from '../components/home/DragonHeroScene';

const FEATURES = [
  {
    icon: '📋',
    title: 'Bulk upload',
    description:
      'Paste product names, import a CSV, or drop in a spreadsheet. Barcodes and SKUs are recognized automatically.',
  },
  {
    icon: '📷',
    title: 'Photo scan',
    description:
      'Snap a photo of sealed product and let OCR extract names and details — no manual typing required.',
  },
  {
    icon: '🔍',
    title: 'Smart product lookup',
    description:
      'Match items against eBay listings with UPC and title search. Ambiguous matches are flagged for your review.',
  },
  {
    icon: '💰',
    title: 'Review & price',
    description:
      'Set condition and quantity, compare market prices, and apply pricing rules before you list.',
  },
  {
    icon: '📤',
    title: 'Export to eBay',
    description:
      'Download eBay-ready CSV or JSON when your batch is priced and ready to go live.',
  },
  {
    icon: '📊',
    title: 'Dashboard overview',
    description:
      'Track ready items, items needing attention, and estimated total value across your current batch.',
  },
] as const;

const STEPS = [
  {
    step: '1',
    title: 'Add your inventory',
    description: 'Upload a list, CSV, or photo scan of the sealed MTG products you want to sell.',
  },
  {
    step: '2',
    title: 'Match & review',
    description: 'Products are looked up automatically. Resolve any ambiguous matches and set pricing.',
  },
  {
    step: '3',
    title: 'Export & list',
    description: 'Export your batch in eBay format and upload it to your seller account.',
  },
] as const;

export function HomePage() {
  const hero = (
    <>
      <BrandLogo variant="auth" decorative className="home-hero-logo" />
      <BrandWordmark as="h1" className="home-hero-wordmark" />
      <p className="home-hero-tagline">
        List Magic: The Gathering sealed products on eBay — faster.
      </p>
      <p className="home-hero-description">
        Upload inventory, match products with UPC lookup, scan photos with OCR,
        price against market data, and export eBay-ready listings from one workspace.
      </p>
      <div className="home-hero-actions">
        <Link to="/register" className="btn-primary btn-lg">Get started free</Link>
        <Link to="/login" className="btn-secondary btn-lg">Sign in</Link>
      </div>
    </>
  );

  return (
    <DragonHeroScene hero={hero}>
      <section className="home-section">
        <div className="home-section-header">
          <h2 className="home-section-title">Everything you need to list sealed product</h2>
          <p className="home-section-subtitle">
            Built for sellers who move boxes, boosters, and bundles — not single cards.
          </p>
        </div>
        <div className="home-features">
          {FEATURES.map(feature => (
            <article key={feature.title} className="home-feature-card">
              <span className="home-feature-icon" aria-hidden="true">{feature.icon}</span>
              <h3 className="home-feature-title">{feature.title}</h3>
              <p className="home-feature-description">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-section--steps">
        <div className="home-section-header">
          <h2 className="home-section-title">How it works</h2>
          <p className="home-section-subtitle">From inventory to eBay export in three steps.</p>
        </div>
        <ol className="home-steps">
          {STEPS.map(item => (
            <li key={item.step} className="home-step">
              <span className="home-step-number">{item.step}</span>
              <div>
                <h3 className="home-step-title">{item.title}</h3>
                <p className="home-step-description">{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-cta">
        <h2 className="home-cta-title">Ready to list your next batch?</h2>
        <p className="home-cta-subtitle">
          Create a free account and upload your first items in minutes.
        </p>
        <Link to="/register" className="btn-primary btn-lg">Create account</Link>
      </section>
    </DragonHeroScene>
  );
}
