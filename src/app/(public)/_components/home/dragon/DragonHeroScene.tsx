'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { DragonHeadArtwork } from './DragonHeadArtwork';
import { DragonFireBreath } from './DragonFireBreath';
import './dragon-hero.css';

type ScenePhase = 'intro' | 'breathing' | 'revealed';

interface DragonHeroSceneProps {
  hero: ReactNode;
  children: ReactNode;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function DragonHeroScene({ hero, children }: DragonHeroSceneProps) {
  const [phase, setPhase] = useState<ScenePhase>('intro');
  const triggeredRef = useRef(false);
  const isPinned = phase !== 'revealed';

  useEffect(() => {
    if (prefersReducedMotion()) {
      triggeredRef.current = true;
      setPhase('revealed');
    }
  }, []);

  const triggerFire = useCallback(() => {
    if (triggeredRef.current || phase !== 'intro') return;
    triggeredRef.current = true;
    setPhase('breathing');
  }, [phase]);

  useEffect(() => {
    if (phase !== 'breathing') return;
    const timer = window.setTimeout(() => setPhase('revealed'), 2400);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'revealed') return;

    // Block residual wheel momentum, then snap to top of content — never past it
    const blockWheel = (e: Event) => e.preventDefault();

    window.addEventListener('wheel', blockWheel, { passive: false });
    window.addEventListener('touchmove', blockWheel, { passive: false });

    const snap = () => {
      window.scrollTo(0, 0);
    };

    requestAnimationFrame(() => requestAnimationFrame(snap));

    const unlock = window.setTimeout(() => {
      window.removeEventListener('wheel', blockWheel);
      window.removeEventListener('touchmove', blockWheel);
    }, 400);

    return () => {
      window.clearTimeout(unlock);
      window.removeEventListener('wheel', blockWheel);
      window.removeEventListener('touchmove', blockWheel);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === 'breathing') {
      const block = (e: Event) => e.preventDefault();
      window.addEventListener('wheel', block, { passive: false });
      window.addEventListener('touchmove', block, { passive: false });
      return () => {
        window.removeEventListener('wheel', block);
        window.removeEventListener('touchmove', block);
      };
    }

    if (phase !== 'intro') return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY <= 0) return;
      e.preventDefault();
      triggerFire();
    };

    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      if (touchStartY - y > 30) {
        e.preventDefault();
        triggerFire();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        triggerFire();
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [phase, triggerFire]);

  const contentVisible = phase === 'revealed';

  return (
    <div className={`home-page dragon-scene${contentVisible ? ' dragon-scene--revealed' : ''}`}>
      <DragonFireBreath active={phase === 'breathing'} />

      {isPinned && <div className="dragon-pin-spacer" aria-hidden="true" />}

      <section
        className={`dragon-stage dragon-scene-phase--${phase}${isPinned ? ' dragon-stage--pinned' : ''}`}
        aria-label="Welcome"
      >
        <div className="dragon-head-scene">
          <DragonHeadArtwork phase={phase} className="dragon-head-artwork" />
          <div className={`dragon-mouth-content${phase === 'breathing' ? ' dragon-mouth-content--burning' : ''}`}>
            {hero}
          </div>
        </div>

        {phase === 'intro' && (
          <button
            type="button"
            className="home-scroll-hint"
            onClick={triggerFire}
            aria-label="Scroll down to explore features"
          >
            <span className="home-scroll-hint-text">Scroll to explore</span>
            <span className="home-scroll-hint-arrow" aria-hidden="true">↓</span>
          </button>
        )}
      </section>

      <div
        id="home-content"
        className={`home-content-reveal${contentVisible ? ' home-content-reveal--visible' : ''}`}
        aria-hidden={!contentVisible}
      >
        {children}
      </div>
    </div>
  );
}
