'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

interface DragonFireBreathProps {
  active: boolean;
}

/** Full-screen dragon fire breath */
export function DragonFireBreath({ active }: DragonFireBreathProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!active || !mounted) return null;

  return createPortal(
    <div className="dragon-fire-overlay dragon-fire-overlay--active" aria-hidden="true">
      <div className="dragon-fire-tongues" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className={`dragon-fire-tongue dragon-fire-tongue--${i + 1}`} />
        ))}
      </div>

      <div className="dragon-fire-heat-wave" />

      <div className="dragon-fire-embers">
        {Array.from({ length: 32 }, (_, i) => (
          <span key={i} className={`dragon-fire-ember dragon-fire-ember--${i + 1}`} />
        ))}
      </div>
    </div>,
    document.body,
  );
}
