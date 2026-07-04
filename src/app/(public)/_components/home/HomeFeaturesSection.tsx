import { HOME_FEATURES } from './home-content';

export function HomeFeaturesSection() {
  return (
    <section className="home-section">
      <div className="home-section-header">
        <h2 className="home-section-title">Everything you need to list sealed product</h2>
        <p className="home-section-subtitle">
          Built for sellers who move boxes, boosters, and bundles — not single cards.
        </p>
      </div>
      <div className="home-features">
        {HOME_FEATURES.map(feature => (
          <article key={feature.title} className="home-feature-card">
            <span className="home-feature-icon" aria-hidden="true">{feature.icon}</span>
            <h3 className="home-feature-title">{feature.title}</h3>
            <p className="home-feature-description">{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
