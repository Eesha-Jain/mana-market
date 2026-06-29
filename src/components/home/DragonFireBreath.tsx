import { createPortal } from 'react-dom';

interface DragonFireBreathProps {
  active: boolean;
}

/** Full-screen dragon fire breath — SVG stream + flickering tongues. */
export function DragonFireBreath({ active }: DragonFireBreathProps) {
  if (!active) return null;

  return createPortal(
    <div className="dragon-fire-overlay dragon-fire-overlay--active" aria-hidden="true">
      <svg className="dragon-fire-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="flame-core" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#fffef0" />
            <stop offset="15%" stopColor="#ffe566" />
            <stop offset="35%" stopColor="#ff9020" />
            <stop offset="60%" stopColor="#ff4010" />
            <stop offset="85%" stopColor="#c01000" />
            <stop offset="100%" stopColor="#400800" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="flame-outer" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#ff7020" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#e02000" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#600800" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="flame-blue-core" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="20%" stopColor="#a0e8ff" />
            <stop offset="45%" stopColor="#ff8020" />
            <stop offset="100%" stopColor="#ff2000" stopOpacity="0" />
          </linearGradient>
          <filter id="flame-blur">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id="flame-blur-heavy">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>

        <g transform="translate(720, 520)" className="dragon-fire-stream-group">
          <path
            className="dragon-flame dragon-flame--main"
            d="M 0 0 C -40 -30, -120 -80, -280 -100 C -480 -120, -680 -80, -900 20
               C -680 -40, -480 -60, -280 -50 C -120 -40, -40 -15, 0 0 Z"
            fill="url(#flame-core)"
            filter="url(#flame-blur)"
          />
          <path
            className="dragon-flame dragon-flame--main"
            d="M 0 0 C 40 -30, 120 -80, 280 -100 C 480 -120, 680 -80, 900 20
               C 680 -40, 480 -60, 280 -50 C 120 -40, 40 -15, 0 0 Z"
            fill="url(#flame-core)"
            filter="url(#flame-blur)"
          />
          <path
            className="dragon-flame dragon-flame--core"
            d="M 0 0 C -20 -20, -60 -60, -140 -70 C -260 -75, -400 -40, -520 10
               C -400 -20, -260 -35, -140 -30 C -60 -20, -20 -8, 0 0 Z"
            fill="url(#flame-blue-core)"
            filter="url(#flame-blur)"
          />
          <path
            className="dragon-flame dragon-flame--core"
            d="M 0 0 C 20 -20, 60 -60, 140 -70 C 260 -75, 400 -40, 520 10
               C 400 -20, 260 -35, 140 -30 C 60 -20, 20 -8, 0 0 Z"
            fill="url(#flame-blue-core)"
            filter="url(#flame-blur)"
          />
          <path
            className="dragon-flame dragon-flame--down"
            d="M -30 10 C -200 80, -350 200, -500 400 C -300 250, -150 120, -30 10 Z"
            fill="url(#flame-outer)"
            filter="url(#flame-blur-heavy)"
          />
          <path
            className="dragon-flame dragon-flame--down"
            d="M 30 10 C 200 80, 350 200, 500 400 C 300 250, 150 120, 30 10 Z"
            fill="url(#flame-outer)"
            filter="url(#flame-blur-heavy)"
          />
          <path
            className="dragon-flame dragon-flame--down-center"
            d="M -20 5 C -80 100, -120 250, -140 450 C -60 280, -30 120, -20 5 Z"
            fill="url(#flame-core)"
            opacity="0.85"
            filter="url(#flame-blur)"
          />
          <path
            className="dragon-flame dragon-flame--down-center"
            d="M 20 5 C 80 100, 120 250, 140 450 C 60 280, 30 120, 20 5 Z"
            fill="url(#flame-core)"
            opacity="0.85"
            filter="url(#flame-blur)"
          />
          <path
            className="dragon-flame dragon-flame--forward"
            d="M -180 -20 C -350 60, -550 180, -720 350 C -500 200, -320 80, -180 -20 Z"
            fill="url(#flame-outer)"
            filter="url(#flame-blur-heavy)"
          />
          <path
            className="dragon-flame dragon-flame--forward"
            d="M 180 -20 C 350 60, 550 180, 720 350 C 500 200, 320 80, 180 -20 Z"
            fill="url(#flame-outer)"
            filter="url(#flame-blur-heavy)"
          />
        </g>
      </svg>

      <div className="dragon-fire-tongues" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
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
