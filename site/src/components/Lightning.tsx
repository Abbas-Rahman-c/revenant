import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type Point = { x: number; y: number };
export type LightningHandle = {
  /** Arcs from each source to its target, in viewport pixels. Resolves when the bolts fade. */
  strike(pairs: Array<[Point, Point]>): Promise<void>;
};

type Seg = { a: Point; b: Point; w: number };

/** Midpoint displacement: split each segment, push the midpoint sideways, halve the push, repeat. */
function bolt(a: Point, b: Point, spread: number, depth: number, width: number, out: Seg[]) {
  if (depth === 0) {
    out.push({ a, b, w: width });
    return;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = (Math.random() * 2 - 1) * spread;
  const mid = { x: (a.x + b.x) / 2 + (-dy / len) * off, y: (a.y + b.y) / 2 + (dx / len) * off };
  bolt(a, mid, spread / 2, depth - 1, width, out);
  bolt(mid, b, spread / 2, depth - 1, width, out);
  // occasional branch that wanders off and dies
  if (depth > 3 && Math.random() < 0.28) {
    const angle = Math.atan2(dy, dx) + (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.5);
    const reach = len * (0.25 + Math.random() * 0.25);
    const end = { x: mid.x + Math.cos(angle) * reach, y: mid.y + Math.sin(angle) * reach };
    bolt(mid, end, spread / 3, depth - 2, width * 0.5, out);
  }
}

/** A full-viewport canvas that draws procedural lightning on demand. */
export const Lightning = forwardRef<LightningHandle>(function Lightning(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current!;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      c.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useImperativeHandle(ref, () => ({
    strike(pairs) {
      const c = canvas.current!;
      const g = c.getContext("2d")!;
      const makeSegs = () => {
        const segs: Seg[] = [];
        for (const [a, b] of pairs) bolt(a, b, Math.hypot(b.x - a.x, b.y - a.y) * 0.22, 7, 2.4, segs);
        return segs;
      };
      // three re-strikes, each with new geometry, at least 120 ms apart (never a strobe)
      const strikes = [0, 140, 300].map((at) => ({ at, segs: makeSegs() }));
      const life = 520;
      const start = performance.now();
      return new Promise<void>((resolve) => {
        const frame = (now: number) => {
          const t = now - start;
          g.clearRect(0, 0, c.width, c.height);
          g.globalCompositeOperation = "lighter";
          g.lineCap = "round";
          for (const s of strikes) {
            const age = t - s.at;
            if (age < 0 || age > life) continue;
            const fade = 1 - age / life;
            for (const seg of s.segs) {
              g.beginPath();
              g.moveTo(seg.a.x, seg.a.y);
              g.lineTo(seg.b.x, seg.b.y);
              g.strokeStyle = `rgba(110, 160, 255, ${0.22 * fade})`;
              g.lineWidth = seg.w * 7;
              g.stroke();
              g.strokeStyle = `rgba(170, 205, 255, ${0.55 * fade})`;
              g.lineWidth = seg.w * 2.6;
              g.stroke();
              g.strokeStyle = `rgba(240, 246, 255, ${fade})`;
              g.lineWidth = seg.w * 0.9;
              g.stroke();
            }
          }
          g.globalCompositeOperation = "source-over";
          if (t < strikes[strikes.length - 1].at + life) requestAnimationFrame(frame);
          else {
            g.clearRect(0, 0, c.width, c.height);
            resolve();
          }
        };
        requestAnimationFrame(frame);
      });
    },
  }));

  return <canvas ref={canvas} className="lightning" aria-hidden="true" />;
});
