'use client';

import { DragonHeroScene } from './dragon/DragonHeroScene';
import { HomeCtaSection } from './HomeCtaSection';
import { HomeFeaturesSection } from './HomeFeaturesSection';
import { HomeHero } from './HomeHero';
import { HomeStepsSection } from './HomeStepsSection';
import './home.css';

export function HomePage() {
  return (
    <DragonHeroScene hero={<HomeHero />}>
      <HomeFeaturesSection />
      <HomeStepsSection />
      <HomeCtaSection />
    </DragonHeroScene>
  );
}
