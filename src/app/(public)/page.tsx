'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { BrandWordmark } from '@/components/ui/BrandWordmark';
import { DragonHeroScene } from '@/components/ui/DragonHeroScene';
import './page.css';

export default function Page() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/manage');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="loading-full">
        <div className="spinner" />
      </div>
    );
  }

  if (user) return null;

  return (
    <DragonHeroScene
      hero={
        <>
          <BrandLogo variant="auth" decorative className="home-hero-logo" />
          <BrandWordmark as="h1" className="home-hero-wordmark" />
          <p className="home-hero-tagline">Sell anything. One workspace.</p>
          <p className="home-hero-description">
            Upload inventory, price from catalog data, list everywhere.
          </p>
          <div className="home-hero-actions">
            <Link href="/register" className="btn-cta btn-lg">
              Get started
            </Link>
            <Link href="/login" className="btn-secondary btn-lg">
              Sign in
            </Link>
          </div>
        </>
      }
    >
      <section className="landing-reveal">
        <p className="landing-reveal-text">Your market manager for resellers.</p>
        <Link href="/register" className="btn-cta btn-lg">
          Create free account
        </Link>
      </section>
    </DragonHeroScene>
  );
}
