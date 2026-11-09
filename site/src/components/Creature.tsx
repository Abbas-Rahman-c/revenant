import { forwardRef, useId } from "react";
import { ORGANS, type OrganId } from "../organs";

type Props = {
  parts: Set<OrganId>;
  alive: boolean;
  charging: boolean;
  /** Play the one-time build sequence: bones, then muscle, then flesh, then sutures. */
  intro?: boolean;
};

/** Small engraved glyph for each part, drawn around (0, 0). Used in the jars and on the implants. */
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
        <g className="glyph">
          {[-14, 14].map((x) => (
            <g key={x} transform={`translate(${x} 0)`}>
              <path d="M-11 0c5-7 17-7 22 0-5 7-17 7-22 0z" />
              <circle r="4" />
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

/* Body outlines, viewBox 320 x 520. The head sits over the neck and torso. */
const HEAD =
  "M160 20C118 20 94 48 94 98c0 30 6 52 18 68 10 14 28 24 48 24s38-10 48-24c12-16 18-38 18-68 0-50-24-78-66-78z";
const EAR_L = "M96 108c-10-4-16 6-14 20 2 12 8 22 16 22";
const EAR_R = "M224 108c10-4 16 6 14 20-2 12-8 22-16 22";
const TORSO =
  "M132 168l-2 44c-26 10-58 18-78 32-18 12-28 40-30 86L20 520h280l-2-190c-2-46-12-74-30-86-20-14-52-22-78-32l-2-44z";
/** The left arm and shoulder came from another body: a different skin tone, sewn on. */
const DONOR_ARM = "M20 520V330c2-46 12-74 32-86 8-5 16-8 22-10 6 30 2 66-8 100-6 22-10 60-10 186z";

/** Pale, slightly cold flesh. Two donors, two tones. */
const SKIN = "#8b7d74";
const SKIN_DONOR = "#7f877f";

/**
 * The creature: a stitched body under a single cold key light. Parts sit in copper-rimmed implants,
 * the eyes are real eyes, and the copper temple clamps are where the lightning lands.
 */
export const Creature = forwardRef<SVGSVGElement, Props>(function Creature(
  { parts, alive, charging, intro = false },
  ref,
) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `${name}-${uid}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <svg
      ref={ref}
      className={`creature${alive ? " is-alive" : ""}${charging ? " is-charging" : ""}${intro ? " is-intro" : ""}`}
      viewBox="0 0 320 520"
      role="img"
      aria-label={`The creature, with ${parts.size} of 5 parts stitched${alive ? ", alive" : ""}`}
    >
      <defs>
        {/* volume: a blurred height map lit from the upper left gives the flesh its roundness */}
        <filter id={id("volume")} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="9" result="height" />
          <feDiffuseLighting in="height" surfaceScale="9" diffuseConstant="0.98" lightingColor="#ffffff" result="diffuse">
            <feDistantLight azimuth="235" elevation="52" />
          </feDiffuseLighting>
          <feSpecularLighting in="height" surfaceScale="7" specularConstant="0.55" specularExponent="22" lightingColor="#fff6ee" result="spec">
            <feDistantLight azimuth="235" elevation="40" />
          </feSpecularLighting>
          <feComposite in="SourceGraphic" in2="diffuse" operator="arithmetic" k1="1" result="lit" />
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
          <feComposite in="lit" in2="specIn" operator="arithmetic" k2="1" k3="0.28" result="shaded" />
          <feComposite in="shaded" in2="SourceAlpha" operator="in" />
        </filter>
        {/* pores and blotches */}
        <filter id={id("pores")} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="4" result="fine" />
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="9" result="blotch" />
          <feComposite in="fine" in2="blotch" operator="arithmetic" k2="0.5" k3="0.5" result="mix" />
          <feColorMatrix
            in="mix"
            values="0 0 0 0 0.28  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 -1.2 1.05"
          />
        </filter>
        <filter id={id("soft")} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <filter id={id("softer")} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <clipPath id={id("bodyclip")}>
          <path d={TORSO} />
          <path d={HEAD} />
        </clipPath>
        <linearGradient id={id("revealgrad")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.07" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id={id("reveal")} maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="520">
          <rect className="reveal-rect" x="-20" y="-60" width="360" height="640" fill={url("revealgrad")} />
        </mask>
        <radialGradient id={id("sclera")} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ece4d6" />
          <stop offset="1" stopColor="#a99e8f" />
        </radialGradient>
        <radialGradient id={id("iris")} cx="50%" cy="50%" r="50%">
          <stop offset="0.25" stopColor="#3c3a40" />
          <stop offset="0.7" stopColor="#6e6b72" />
          <stop offset="1" stopColor="#2a282d" />
        </radialGradient>
        <radialGradient id={id("implant")} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#4b4950" />
          <stop offset="1" stopColor="#1c1b1f" />
        </radialGradient>
      </defs>

      {/* 1. the skeleton is drawn first */}
      <g className="bones" fill="none">
        <path pathLength={1} d="M160 30c-36 0-56 26-56 66 0 24 6 42 16 54 4 6 6 12 8 20M160 30c36 0 56 26 56 66 0 24-6 42-16 54-4 6-6 12-8 20" />
        <path pathLength={1} d="M124 118c4-12 26-12 30 0-4 10-26 10-30 0zM166 118c4-12 26-12 30 0-4 10-26 10-30 0z" />
        <path pathLength={1} d="M160 128l-7 20h14z" />
        <path pathLength={1} d="M128 170c10 14 22 20 32 20s22-6 32-20M138 172h44" />
        <path pathLength={1} d="M160 192v70" />
        <path pathLength={1} d="M150 252c-24-4-58 0-90 10M170 252c24-4 58 0 90 10" />
        <path pathLength={1} d="M160 262v120" />
        <path pathLength={1} d="M156 280c-22 2-48 12-62 30M164 280c22 2 48 12 62 30M156 304c-22 2-46 14-58 32M164 304c22 2 46 14 58 32M156 328c-20 4-40 16-50 34M164 328c20 4 40 16 50 34M156 352c-18 4-34 16-42 32M164 352c18 4 34 16 42 32" />
        <path pathLength={1} d="M52 262c-12 4-18 14-18 26M268 262c12 4 18 14 18 26" />
      </g>

      {/* 2. then the muscle */}
      <g className="muscle" fill="none">
        <path pathLength={1} d="M104 82c6 22 8 46 18 66M216 82c-6 22-8 46-18 66" />
        <path pathLength={1} d="M118 146c8 14 10 24 22 34M202 146c-8 14-10 24-22 34" />
        <path pathLength={1} d="M110 150c10 24 28 64 44 104M210 150c-10 24-28 64-44 104" />
        <path pathLength={1} d="M134 210c-28 14-60 24-82 36M186 210c28 14 60 24 82 36" />
        <path pathLength={1} d="M156 262c-20-2-62 4-90 16 6 26 26 48 62 52 14 2 26-6 28-20zM164 262c20-2 62 4 90 16-6 26-26 48-62 52-14 2-26-6-28-20z" />
        <path pathLength={1} d="M52 250c-16 16-22 46-20 80M268 250c16 16 22 46 20 80" />
        <path pathLength={1} d="M140 360c6 30 6 60 4 100M180 360c-6 30-6 60-4 100M140 400h40M140 436h40" />
      </g>

      {/* 3. then the flesh grows over it, bottom to top */}
      <g mask={url("reveal")} className="flesh-layer">
        <g filter={url("volume")}>
          <path d={TORSO} fill={SKIN} />
          <path d={DONOR_ARM} fill={SKIN_DONOR} />
          <path d={HEAD} fill={SKIN} />
          <path d={EAR_L} fill={SKIN} stroke={SKIN} strokeWidth="6" />
          <path d={EAR_R} fill={SKIN} stroke={SKIN} strokeWidth="6" />
        </g>

        {/* anatomy shadows, multiplied into the skin */}
        <g clipPath={url("bodyclip")} className="shade">
          <g filter={url("softer")} fill="#2a1f1e">
            <ellipse cx="160" cy="200" rx="40" ry="13" opacity="0.7" />
            <ellipse cx="104" cy="250" rx="34" ry="10" opacity="0.35" />
            <ellipse cx="216" cy="250" rx="34" ry="10" opacity="0.35" />
            <path d="M80 320c26 20 56 22 78 6v20c-26 10-58 6-80-10z" opacity="0.6" />
            <path d="M240 320c-26 20-56 22-78 6v20c26 10 58 6 80-10z" opacity="0.6" />
            <path d="M74 290c-4 60-2 140 2 230h14c-6-90-6-170-2-230z" opacity="0.55" />
            <path d="M246 290c4 60 2 140-2 230h-14c6-90 6-170 2-230z" opacity="0.55" />
            <path d="M132 214c-20 10-46 18-70 30l6 10c22-10 46-20 66-28z" opacity="0.35" />
            <path d="M188 214c20 10 46 18 70 30l-6 10c-22-10-46-20-66-28z" opacity="0.35" />
            <ellipse cx="160" cy="470" rx="70" ry="40" opacity="0.3" />
            <ellipse cx="160" cy="40" rx="70" ry="22" opacity="0" />
          </g>
          <g filter={url("soft")} fill="none" stroke="#2a1f1e" strokeLinecap="round">
            <path d="M150 252c-24-4-58 0-90 10M170 252c24-4 58 0 90 10" strokeWidth="5" opacity="0.55" />
            <path d="M160 268v110" strokeWidth="6" opacity="0.5" />
            <path d="M112 152c10 24 28 62 44 100M208 152c-10 24-28 62-44 100" strokeWidth="5" opacity="0.45" />
            <path d="M66 262c-8 24-10 50-6 76M254 262c8 24 10 50 6 76" strokeWidth="7" opacity="0.45" />
            <path d="M128 400c10 4 22 4 32 0M160 400c10 4 22 4 32 0M128 436c10 4 22 4 32 0M160 436c10 4 22 4 32 0" strokeWidth="3" opacity="0.18" />
            <path d="M140 380c4 30 4 60 2 100M180 380c-4 30-4 60-2 100" strokeWidth="4" opacity="0.18" />
          </g>
          {/* face */}
          <g filter={url("soft")} fill="#2a1f1e">
            <ellipse cx="139" cy="116" rx="17" ry="11" opacity="0.5" />
            <ellipse cx="181" cy="116" rx="17" ry="11" opacity="0.5" />
            <ellipse cx="128" cy="146" rx="10" ry="16" opacity="0.28" />
            <ellipse cx="192" cy="146" rx="10" ry="16" opacity="0.28" />
            <path d="M154 126l-7 22c4 4 9 5 13 5v-27z" opacity="0.32" />
            <ellipse cx="153" cy="149" rx="3.4" ry="2" opacity="0.7" />
            <ellipse cx="167" cy="149" rx="3.4" ry="2" opacity="0.7" />
            <path d="M145 163c8-4 22-4 30 0-6 3-24 3-30 0z" opacity="0.55" />
            <ellipse cx="160" cy="176" rx="12" ry="4" opacity="0.25" />
          </g>
          <g filter={url("soft")} fill="#fff4ea" className="highlights">
            <ellipse cx="146" cy="56" rx="26" ry="14" opacity="0.16" />
            <path d="M159 104v38" stroke="#fff4ea" strokeWidth="3" opacity="0.28" />
            <ellipse cx="160" cy="144" rx="4" ry="3" opacity="0.3" />
            <ellipse cx="124" cy="132" rx="9" ry="5" opacity="0.18" />
            <ellipse cx="196" cy="132" rx="9" ry="5" opacity="0.12" />
            <ellipse cx="160" cy="169" rx="9" ry="2.6" opacity="0.22" />
            <ellipse cx="62" cy="262" rx="18" ry="10" opacity="0.22" />
            <path d="M150 246c-24-4-58 0-90 10" stroke="#fff4ea" strokeWidth="3" fill="none" opacity="0.2" />
            <path d="M170 246c24-4 58 0 90 10" stroke="#fff4ea" strokeWidth="3" fill="none" opacity="0.14" />
            <ellipse cx="112" cy="282" rx="30" ry="12" opacity="0.12" />
            <ellipse cx="208" cy="282" rx="30" ry="12" opacity="0.08" />
          </g>
          {/* skin texture */}
          <rect x="0" y="0" width="320" height="520" filter={url("pores")} opacity="0.7" className="pores" />
          {/* veins under thin skin */}
          <g fill="none" stroke="#5c5a74" strokeWidth="0.9" opacity="0.32" strokeLinecap="round">
            <path d="M44 300c4 30-2 60 6 92 4 18 0 40 4 70" />
            <path d="M50 340c8 10 6 26 12 34" />
            <path d="M120 186c4 10 2 22 8 28" />
            <path d="M112 60c8 6 10 16 18 18" />
          </g>
        </g>

        {/* the face's fine lines */}
        <g className="face" fill="none" strokeLinecap="round">
          <path d="M125 104c8-6 20-7 28-2M195 104c-8-6-20-7-28-2" stroke="#3b2f2c" strokeWidth="1.6" opacity="0.6" />
          {!parts.has("eyes") && (
            <g className="closed-lids" stroke="#2c2220" strokeWidth="1.4">
              <path d="M126 118c8 5 20 5 26 0M168 118c6 5 18 5 26 0" />
              <path d="M130 120l-1 3M136 122l-.5 3M142 122l.5 3M148 120l1 3M172 120l-1 3M178 122l-.5 3M184 122l.5 3M190 120l1 3" opacity="0.6" />
            </g>
          )}
          <g className={`mouth${alive && parts.has("voice") ? " is-open" : ""}`}>
            <path className="mouth__open" d="M144 163c10 7 22 7 32 0-6 9-26 9-32 0z" fill="#1a1414" stroke="none" />
            <path d="M143 163c10 3 24 3 34 0" stroke="#3b2a28" strokeWidth="1.6" />
            <path className="mouth__stitch" d="M148 158l1.5 10M156 159l.5 10M164 159l-.5 10M172 158l-1.5 10" stroke="#2b1f1d" strokeWidth="1.1" />
          </g>
        </g>
      </g>

      {/* 4. the seams where the pieces were joined */}
      <g className="seams" fill="none" strokeLinecap="round">
        {[
          "M104 74c26-14 86-14 112 0",
          "M128 206c20 8 44 8 64 0",
          "M74 236c6 30 2 66-8 100-6 22-9 60-10 100",
          "M196 268c18 26 36 40 58 46",
        ].map((d, i) => (
          <g key={i}>
            <path pathLength={1} d={d} className="seam__pucker" />
            <path pathLength={1} d={d} className="seam__line" />
            <path d={d} className="seam__ticks" />
          </g>
        ))}
      </g>

      {/* real eyes, once stitched in */}
      {parts.has("eyes") && (
        <g className={`eyes${alive ? " is-open" : ""}`}>
          {[139, 181].map((x) => (
            <g key={x} transform={`translate(${x} 118)`}>
              <path d="M-13 0c6-8 20-8 26 0-6 8-20 8-26 0z" fill={url("sclera")} />
              <g className="eyes__iris">
                <circle r="5.6" fill={url("iris")} />
                <circle r="2.3" fill="#121114" />
                <circle cx="-1.6" cy="-1.8" r="1" fill="#fff" opacity="0.8" />
              </g>
              <path className="lid lid--top" d="M-15 0c6-10 24-10 30 0v-12h-30z" fill={SKIN} />
              <path className="lid lid--bottom" d="M-15 0c6 9 24 9 30 0v11h-30z" fill={SKIN} />
              <path className="lid-line" d="M-13 0c6 4 20 4 26 0" />
            </g>
          ))}
        </g>
      )}

      {/* copper temple clamps: dull until power flows, then the lightning lands on them */}
      <g className="clamps">
        {[
          { x: 88, flip: 1 },
          { x: 232, flip: -1 },
        ].map(({ x, flip }) => (
          <g key={x} transform={`translate(${x} 100) scale(${flip} 1)`}>
            <g className="clamp">
              <rect x="-14" y="-7" width="16" height="14" rx="2" />
              <path d="M-14 0h-14" />
              <circle cx="-30" cy="0" r="4" className={`terminal${charging || alive ? " is-hot" : ""}`} data-terminal />
            </g>
          </g>
        ))}
      </g>

      {/* surgical marks and implants for the other parts */}
      {ORGANS.filter((o) => o.id !== "eyes").flatMap((o) =>
        // ears come as a pair: one implant on each side of the head
        (o.id === "ears" ? [1, -1] : [1]).map((side) => ({ o, side })),
      ).map(({ o, side }) => {
        const on = parts.has(o.id);
        const x = side === 1 ? o.socket.x : 320 - o.socket.x;
        const scale = o.id === "ears" ? 0.78 : 1;
        return (
          <g
            key={`${o.id}${side}`}
            transform={`translate(${x} ${o.socket.y}) scale(${side * scale} ${scale})`}
            className={`socket${on ? " is-on" : ""}`}
          >
            <circle r="24" className="socket-mark" />
            {on && (
              <>
                <circle r="27" className="implant-pucker" filter={url("soft")} />
                <circle r="21" fill={url("implant")} className="implant" />
                <circle r="21" className="implant-rim" />
                <g transform="scale(0.62)">
                  <Glyph id={o.id} alive={alive} />
                </g>
                <g className="suture">
                  <circle r="27" pathLength={100} className="suture-thread" />
                  <circle r="27" pathLength={100} className="suture-ticks" />
                </g>
              </>
            )}
          </g>
        );
      })}

      {/* life: a cold glow that breathes in the chest once alive */}
      <circle cx="160" cy="300" r="70" className="life" filter={url("softer")} />
    </svg>
  );
});
