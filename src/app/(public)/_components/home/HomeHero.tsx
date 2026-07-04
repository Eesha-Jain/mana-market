'use client';

import Link from 'next/link';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { BrandWordmark } from '@/components/ui/BrandWordmark';

export function HomeHero() {
  return (
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
        <Link href="/register" className="btn-primary btn-lg">Get started free</Link>
        <Link href="/login" className="btn-secondary btn-lg">Sign in</Link>
      </div>
    </>
  );
}
