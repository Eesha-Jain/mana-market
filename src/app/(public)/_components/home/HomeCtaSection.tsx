import Link from 'next/link';

export function HomeCtaSection() {
  return (
    <section className="home-cta">
      <h2 className="home-cta-title">Ready to list your next batch?</h2>
      <p className="home-cta-subtitle">
        Create a free account and upload your first items in minutes.
      </p>
      <Link href="/register" className="btn-primary btn-lg">Create account</Link>
    </section>
  );
}
