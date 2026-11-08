import { forwardRef } from "react";
import { ORGANS, type OrganId } from "../organs";

type Props = {
  parts: Set<OrganId>;
  alive: boolean;
  charging: boolean;
};

/** Small engraved glyph for each part, drawn around (0, 0). */
export function Glyph({ id, alive }: { id: OrganId; alive: boolean }) {
  switch (id) {
    case "brain":
      return (
        <g className="glyph">
          <path d="M-22 6c-6-2-8-10-3-15 0-8 9-12 15-8 4-6 16-6 20 0 6-4 15 0 15 8 5 5 3 13-3 15 0 7-8 10-14 7-4 4-12 4-16 0-6 3-14 0-14-7z" />
          <path d="M-12-12c2 4 0 8-4 10M2-16c-2 6 2 9 6 10M14-8c-4 2-4 7 0 9M-4 2c3 2 8 2 10-1M-18-2c4 0 6 3 5 7" />
        </g>
      );
    case "eyes":
      return (
        <g className={`glyph glyph--eyes${alive ? " is-open" : ""}`}>
          {[-22, 22].map((x) => (
            <g key={x} transform={`translate(${x} 0)`}>
              <path d="M-13 0c6-8 20-8 26 0-6 8-20 8-26 0z" className="eye-white" />
              <circle r="5.5" className="iris" />
              <circle r="2.2" className="pupil" />
              <path d="M-14 0c6-9 22-9 28 0v-10h-28z" className="lid lid--top" />
              <path d="M-14 0c6 9 22 9 28 0v10h-28z" className="lid lid--bottom" />
            </g>
          ))}
        </g>
      );
    case "ears":
      return (
        <g className="glyph">
          <path d="M6-16c-12-4-20 6-18 16 1 6 6 8 6 14 0 5 6 6 8 1" />
          <path d="M1-8c-5-1-8 4-6 8 2 3 5 3 5 7" />
        </g>
      );
    case "voice":
      return (
        <g className="glyph">
          <path d="M-8-12h16v24h-16z" />
          <path d="M-8-4h16M-8 4h16" />
          <path d="M14-8c4 4 4 12 0 16M19-13c7 7 7 19 0 26" className={alive ? "wave is-live" : "wave"} />
        </g>
      );
    case "memory":
      return (
        <g className="glyph">
          <path d="M0 14c-14-9-20-16-20-24 0-6 5-10 10-10 4 0 7 2 10 6 3-4 6-6 10-6 5 0 10 4 10 10 0 8-6 15-20 24z" />
          <path d="M-8-6c2 4 6 6 8 12M6-10v6" />
        </g>
      );
  }
}

/**
 * The creature: an anatomical engraving on a tilted slab. Parts appear in their sockets with
 * a suture sewn around them; the copper temple clamps are where the lightning lands.
 */
export const Creature = forwardRef<SVGSVGElement, Props>(function Creature({ parts, alive, charging }, ref) {
  return (
    <svg
      ref={ref}
      className={`creature${alive ? " is-alive" : ""}${charging ? " is-charging" : ""}`}
      viewBox="0 0 320 520"
      role="img"
      aria-label={`The creature, with ${parts.size} of 5 parts stitched${alive ? ", alive" : ""}`}
    >
      <defs>
        <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--silver)" strokeWidth="0.7" opacity="0.35" />
        </pattern>
        <pattern id="hatch-fine" width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
          <line x1="0" y1="0" x2="0" y2="3.5" stroke="var(--silver)" strokeWidth="0.5" opacity="0.25" />
        </pattern>
        <radialGradient id="skin" cx="45%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#56545b" />
          <stop offset="100%" stopColor="#2f2e33" />
        </radialGradient>
        <filter id="arcglow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* body silhouette */}
      <g className="body">
        <path
          d="M160 18c-44 0-70 30-70 76 0 30 10 54 26 70l4 30c-34 10-74 22-92 44-14 18-20 60-20 110v172h304V348c0-50-6-92-20-110-18-22-58-34-92-44l4-30c16-16 26-40 26-70 0-46-26-76-70-76z"
          fill="url(#skin)"
          stroke="var(--silver)"
          strokeWidth="1.4"
        />
        <path
          d="M160 18c-44 0-70 30-70 76 0 30 10 54 26 70l4 30c-34 10-74 22-92 44-14 18-20 60-20 110v172h304V348c0-50-6-92-20-110-18-22-58-34-92-44l4-30c16-16 26-40 26-70 0-46-26-76-70-76z"
          fill="url(#hatch)"
        />
        {/* jaw, collarbones, sternum in engraving lines */}
        <path className="engrave" d="M118 150c12 22 28 32 42 32s30-10 42-32" />
        <path className="engrave" d="M64 252c30-6 62-4 84 6M256 252c-30-6-62-4-84 6" />
        <path className="engrave" d="M160 262v170" />
        <path className="engrave faint" d="M100 300c14 10 22 30 22 56M220 300c-14 10-22 30-22 56" />
        <path d="M108 200c18 18 86 18 104 0v-12c-18 14-86 14-104 0z" fill="url(#hatch-fine)" />
        {/* face: brow, nose, right ear (the left ear is a socket), and lips sewn shut until it can speak */}
        <path className="engrave" d="M132 100c8-5 18-5 24-1M188 100c-8-5-18-5-24-1" />
        <path className="engrave" d="M158 124c-3 8-6 14-8 20 4 3 10 3 14 1" />
        <path className="engrave faint" d="M136 150c6 2 10 1 12-2M184 150c-6 2-10 1-12-2" />
        <path className="engrave" d="M226 108c10-2 14 8 12 20-2 14-8 22-14 22" />
        <path className="engrave faint" d="M228 118c4 0 5 6 3 12" />
        <g className={`mouth${alive && parts.has("voice") ? " is-open" : ""}`}>
          <path className="mouth__line" d="M142 162c10 4 26 4 36 0" />
          <path className="mouth__open" d="M144 161c10 6 22 6 32 0-6 8-26 8-32 0z" />
          <path className="mouth__stitch" d="M146 156l2 12M154 157l1 12M162 157v12M170 157l-1 12M176 156l-2 12" />
        </g>
      </g>

      {/* old sutures the creature already has */}
      <g className="scar">
        <path d="M108 74c24-12 80-12 104 0" />
        <path className="ticks" d="M108 74c24-12 80-12 104 0" />
        <path d="M60 318c20 8 40 22 52 40" />
        <path className="ticks" d="M60 318c20 8 40 22 52 40" />
      </g>

      {/* copper temple clamps: the lightning targets */}
      <g className="clamps">
        {[
          { x: 88, flip: 1 },
          { x: 232, flip: -1 },
        ].map(({ x, flip }) => (
          <g key={x} transform={`translate(${x} 100) scale(${flip} 1)`}>
            <rect x="-14" y="-7" width="16" height="14" rx="2" />
            <path d="M-14 0h-14" />
            <circle cx="-30" cy="0" r="4" className={`terminal${charging || alive ? " is-hot" : ""}`} data-terminal />
          </g>
        ))}
      </g>

      {/* sockets and parts */}
      {ORGANS.map((o) => {
        const on = parts.has(o.id);
        return (
          <g key={o.id} transform={`translate(${o.socket.x} ${o.socket.y})`} className={`socket${on ? " is-on" : ""}`}>
            {o.id !== "eyes" && <circle r="27" className="socket-ring" />}
            {on && (
              <>
                {o.id !== "eyes" && (
                  <g className="suture">
                    <circle r="31" pathLength={100} className="suture-thread" />
                    <circle r="31" pathLength={100} className="suture-ticks" />
                  </g>
                )}
                <Glyph id={o.id} alive={alive} />
              </>
            )}
            {!on && o.id === "eyes" && (
              <g className="closed-eyes">
                <path d="M-34 0c6 4 18 4 24 0M10 0c6 4 18 4 24 0" />
              </g>
            )}
          </g>
        );
      })}

      {/* life: a glow that breathes in the chest once alive */}
      <circle cx="160" cy="300" r="70" className="life" filter="url(#arcglow)" />
    </svg>
  );
});
