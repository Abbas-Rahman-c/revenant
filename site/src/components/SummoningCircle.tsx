import { useMemo } from "react";

type Props = {
  /** Download progress from 0 to 1. */
  progress: number;
  /** True once the model is loaded and ready. */
  ready: boolean;
  size?: number;
};

const SIGILS = 24;
const C = 200; // viewBox centre

/** Small deterministic PRNG so sigils look hand-drawn but never change between renders. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sigilPath(rand: () => number) {
  const s = 7;
  const strokes = 2 + Math.floor(rand() * 3);
  let d = "";
  for (let i = 0; i < strokes; i++) {
    const x1 = (rand() * 2 - 1) * s;
    const y1 = (rand() * 2 - 1) * s;
    const x2 = (rand() * 2 - 1) * s;
    const y2 = (rand() * 2 - 1) * s;
    d += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  if (rand() < 0.45) d += `M0 ${-s - 3}m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0`;
  return d;
}

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
}

/**
 * The summoning circle: chalk rings and sigils that light up as a model downloads.
 * The outer arc is the progress bar; the flame appears when the model is ready.
 */
export function SummoningCircle({ progress, ready, size = 440 }: Props) {
  const sigils = useMemo(() => {
    const rand = mulberry32(13);
    return Array.from({ length: SIGILS }, (_, i) => ({
      angle: (360 * (i + 0.5)) / SIGILS,
      d: sigilPath(rand),
      tilt: (rand() * 2 - 1) * 12,
    }));
  }, []);

  const R = 168;
  const circumference = 2 * Math.PI * R;
  const p = Math.min(Math.max(progress, 0), 1);
  const [sparkX, sparkY] = polar(R, 360 * p);
  const octagram = [0, 45]
    .map((rot) =>
      [0, 90, 180, 270]
        .map((a) => polar(122, a + rot).map((n) => n.toFixed(1)).join(" "))
        .join(" L"),
    )
    .map((pts) => `M${pts}Z`)
    .join(" ");

  return (
    <svg
      className={`circle${ready ? " circle--ready" : ""}`}
      viewBox="0 0 400 400"
      width={size}
      height={size}
      role="img"
      aria-label={
        ready ? "Summoning circle, model ready" : `Summoning circle, ${Math.round(p * 100)} percent loaded`
      }
    >
      <defs>
        <filter id="chalk" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" />
        </filter>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="flame" cx="50%" cy="70%" r="60%">
          <stop offset="0%" stopColor="#fff1cf" />
          <stop offset="45%" stopColor="#ffc86b" />
          <stop offset="100%" stopColor="#f2a541" />
        </radialGradient>
      </defs>

      <g filter="url(#chalk)" fill="none" stroke="var(--chalk)" strokeLinecap="round">
        <circle cx={C} cy={C} r={190} strokeWidth={1} opacity={0.35} />
        <circle cx={C} cy={C} r={R} strokeWidth={1.4} opacity={0.4} />
        <circle cx={C} cy={C} r={142} strokeWidth={1.2} opacity={0.45} />
        <circle cx={C} cy={C} r={96} strokeWidth={1} opacity={0.3} />
        <path d={octagram} strokeWidth={1} opacity={0.32} />
      </g>

      <g filter="url(#chalk)">
        {sigils.map((s, i) => {
          const lit = (i + 0.5) / SIGILS <= p;
          const [x, y] = polar(155, s.angle);
          return (
            <path
              key={i}
              d={s.d}
              transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(s.angle + s.tilt).toFixed(1)})`}
              className={lit ? "sigil sigil--lit" : "sigil"}
            />
          );
        })}
      </g>

      {p > 0 && (
        <g filter="url(#glow)">
          <circle
            cx={C}
            cy={C}
            r={R}
            fill="none"
            stroke="var(--candle)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${circumference * p} ${circumference}`}
            transform={`rotate(-90 ${C} ${C})`}
          />
          {!ready && <circle cx={sparkX} cy={sparkY} r={4} fill="#ffe2b8" />}
        </g>
      )}

      <g className="flame" filter="url(#glow)" opacity={ready ? 1 : 0}>
        <path
          d="M200 140 C 214 166, 228 186, 228 210 A 28 28 0 0 1 172 210 C 172 186, 186 166, 200 140 Z"
          fill="url(#flame)"
        />
        <path d="M200 176 C 207 190, 213 199, 213 210 A 13 13 0 0 1 187 210 C 187 199, 193 190, 200 176 Z" fill="#fff6e0" />
      </g>
    </svg>
  );
}
