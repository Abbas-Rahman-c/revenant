import { useEffect, useRef, useState } from "react";
import { probeDevice, type Sigil } from "../probe";

type GaugeProps = {
  label: string;
  value: number | undefined;
  max: number;
  unit: string;
  digits?: number;
  /** Needles settle once, when the panel scrolls into view. */
  live: boolean;
};

/** An analog dial. The needle sweeps 240 degrees, from -120 to 120. */
function Gauge({ label, value, max, unit, digits = 0, live }: GaugeProps) {
  const known = value !== undefined;
  const frac = known ? Math.min(value / max, 1) : 0;
  const angle = live ? -120 + frac * 240 : -120;
  const ticks = Array.from({ length: 25 }, (_, i) => -120 + i * 10);

  return (
    <figure className="gauge">
      <svg viewBox="0 0 160 120" aria-hidden="true">
        <path d="M22 104a70 70 0 1 1 116 0" className="gauge__arc" />
        {ticks.map((a, i) => {
          const r1 = i % 4 === 0 ? 52 : 58;
          const rad = ((a - 90) * Math.PI) / 180;
          return (
            <line
              key={a}
              x1={80 + Math.cos(rad) * r1}
              y1={84 + Math.sin(rad) * r1}
              x2={80 + Math.cos(rad) * 64}
              y2={84 + Math.sin(rad) * 64}
              className={i % 4 === 0 ? "gauge__tick gauge__tick--major" : "gauge__tick"}
            />
          );
        })}
        <g className="gauge__needle" style={{ transform: `rotate(${angle}deg)` }}>
          <path d="M80 84L78 30l2-8 2 8z" />
        </g>
        <circle cx="80" cy="84" r="6" className="gauge__hub" />
      </svg>
      <figcaption>
        <span className="gauge__value">{known ? `${value.toFixed(digits)} ${unit}` : "Not shared"}</span>
        <span className="gauge__label">{label}</span>
      </figcaption>
    </figure>
  );
}

const tierCopy: Record<Sigil["tier"], { name: string; text: string }> = {
  tiny: { name: "Tiny", text: "Ears and memory run well here, on the processor. A full creature will be slow." },
  small: { name: "Small", text: "A complete creature with a small brain, accelerated by your graphics card." },
  full: { name: "Full", text: "Room for the largest brain and every part at once, on your graphics card." },
};

/** Real readings from this browser, shown as a lab instrument panel. */
export function VitalSigns() {
  const [sigil, setSigil] = useState<Sigil | null>(null);
  const [live, setLive] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    probeDevice().then(setSigil);
  }, []);

  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setLive(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="vitals" aria-labelledby="vitals-h">
      <div className="section-head">
        <h2 id="vitals-h">Vital signs of your machine</h2>
        <p>Read just now from your browser, on this page. Nothing was sent anywhere.</p>
      </div>
      <div className="vitals__panel" ref={panel}>
        <div className="vitals__gauges">
          <Gauge label="Memory" value={sigil?.memoryGB} max={8} unit="GB+" live={live && !!sigil} />
          <Gauge label="Storage free for models" value={sigil?.storageGB} max={10} unit="GB" digits={1} live={live && !!sigil} />
          <Gauge label="Processor threads" value={sigil?.cores} max={16} unit="" live={live && !!sigil} />
        </div>
        <div className="vitals__verdict">
          <p className="vitals__lamp">
            <span className={`lamp${sigil?.webgpu ? " is-on" : ""}`} aria-hidden="true" />
            {sigil ? (sigil.webgpu ? "WebGPU is on" : "No WebGPU") : "Reading…"}
          </p>
          {sigil?.gpuName && <p className="vitals__gpu">{sigil.gpuName}</p>}
          {sigil && (
            <>
              <p className="vitals__tier">{tierCopy[sigil.tier].name} creature</p>
              <p>{tierCopy[sigil.tier].text}</p>
              <p className="note">An early estimate. The finished runtime measures before it loads anything.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
