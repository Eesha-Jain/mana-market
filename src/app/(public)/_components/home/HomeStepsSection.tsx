import { HOME_STEPS } from './home-content';

export function HomeStepsSection() {
  return (
    <section className="home-section home-section--steps">
      <div className="home-section-header">
        <h2 className="home-section-title">How it works</h2>
        <p className="home-section-subtitle">From inventory to eBay export in three steps.</p>
      </div>
      <ol className="home-steps">
        {HOME_STEPS.map(item => (
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
  );
}
