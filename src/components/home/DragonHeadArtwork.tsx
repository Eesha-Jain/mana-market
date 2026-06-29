import type { CSSProperties } from 'react';

type DragonPhase = 'intro' | 'breathing' | 'revealed';

interface DragonHeadArtworkProps {
  className?: string;
  phase?: DragonPhase;
}

export const DRAGON_HEAD_PATH = '/dragon-head-hero.png';

/** Photorealistic MTG-style dragon head — raster illustration with animated throat glow. */
export function DragonHeadArtwork({ className = '', phase = 'intro' }: DragonHeadArtworkProps) {
  const awake = phase === 'breathing';

  return (
    <div
      className={`dragon-head-artwork-wrap dragon-head-artwork-wrap--${phase} ${className}`.trim()}
      aria-hidden="true"
    >
      <img
        src={DRAGON_HEAD_PATH}
        alt=""
        className="dragon-head-photo"
        draggable={false}
      />
      <div className="dragon-head-vignette" />
      <div
        className={`dragon-head-throat-glow${awake ? ' dragon-head-throat-glow--active' : ''}`}
        style={{ '--glow-intensity': awake ? 1 : 0.45 } as CSSProperties}
      />
      <div className={`dragon-head-eye-glow dragon-head-eye-glow--left${awake ? ' dragon-head-eye-glow--active' : ''}`} />
      <div className={`dragon-head-eye-glow dragon-head-eye-glow--right${awake ? ' dragon-head-eye-glow--active' : ''}`} />
    </div>
  );
}
