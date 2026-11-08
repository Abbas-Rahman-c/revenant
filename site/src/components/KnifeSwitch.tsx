import { useEffect, useRef, useState } from "react";

type Props = {
  disabled: boolean;
  /** True while the lab is charging or the creature is alive: the switch stays closed. */
  closed: boolean;
  onThrow: () => void;
};

const COMMIT = 0.7; // drag past 70% of the travel to close the circuit

/** Damping-1 spring toward a target, starting from the current value and velocity. */
function springTo(from: number, to: number, v0: number, set: (n: number) => void, done?: () => void) {
  const stiffness = 420; // ~0.3 s response, critically damped
  const damping = 2 * Math.sqrt(stiffness);
  let x = from;
  let v = v0;
  let last = performance.now();
  let raf = 0;
  const step = (now: number) => {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const a = -stiffness * (x - to) - damping * v;
    v += a * dt;
    x += v * dt;
    if (Math.abs(x - to) < 0.001 && Math.abs(v) < 0.01) {
      set(to);
      done?.();
      return;
    }
    set(x);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/**
 * A copper knife switch. Drag the handle down 1:1 with the pointer, or press it like a button.
 * Released short of the contacts, it springs back open.
 */
export function KnifeSwitch({ disabled, closed, onThrow }: Props) {
  const [pos, setPos] = useState(0); // 0 open, 1 closed
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startPos: number; lastY: number; lastT: number; v: number } | null>(null);
  const cancelSpring = useRef<() => void>(() => {});
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // reopen when the lab resets
  useEffect(() => {
    if (!closed && pos > 0 && !drag.current) {
      cancelSpring.current();
      if (reduce.current) setPos(0);
      else cancelSpring.current = springTo(pos, 0, 0, setPos);
    }
    if (closed && pos < 1 && !drag.current) setPos(1);
  }, [closed]);

  const travel = () => (track.current?.clientHeight ?? 200) * 0.62;

  function commit(v = 0) {
    cancelSpring.current();
    if (reduce.current) {
      setPos(1);
      onThrow();
      return;
    }
    cancelSpring.current = springTo(pos, 1, v, setPos, onThrow);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (disabled || closed) return;
    cancelSpring.current();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startPos: pos, lastY: e.clientY, lastT: performance.now(), v: 0 };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    let p = d.startPos + (e.clientY - d.startY) / travel();
    // rubber-band past either end instead of a hard stop
    if (p < 0) p = -(-p * 0.55) / (1 + -p * 0.55) * 0.3;
    if (p > 1) p = 1 + ((p - 1) * 0.55) / (1 + (p - 1) * 0.55) * 0.08;
    d.v = ((e.clientY - d.lastY) / travel()) / Math.max((now - d.lastT) / 1000, 0.001);
    d.lastY = e.clientY;
    d.lastT = now;
    setPos(p);
  }

  function onPointerUp() {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    // decide by projected position, so a quick flick closes it too
    const projected = pos + d.v * 0.12;
    if (projected >= COMMIT) commit(d.v);
    else cancelSpring.current = springTo(pos, 0, d.v, setPos);
  }

  const angle = -62 + pos * 62; // blade swings from raised to seated

  return (
    <div className={`knife${disabled ? " is-disabled" : ""}${closed ? " is-closed" : ""}`}>
      <div className="knife__plate" ref={track}>
        <svg viewBox="0 0 120 200" className="knife__svg" aria-hidden="true">
          <rect x="18" y="8" width="84" height="184" rx="6" className="knife__base" />
          <circle cx="30" cy="20" r="3" className="knife__rivet" />
          <circle cx="90" cy="20" r="3" className="knife__rivet" />
          <circle cx="30" cy="180" r="3" className="knife__rivet" />
          <circle cx="90" cy="180" r="3" className="knife__rivet" />
          {/* contacts the blades seat into */}
          <rect x="38" y="140" width="8" height="26" rx="1" className="knife__contact" />
          <rect x="74" y="140" width="8" height="26" rx="1" className="knife__contact" />
          {/* hinge */}
          <rect x="34" y="34" width="52" height="10" rx="3" className="knife__hinge" />
          <g transform={`translate(60 39) rotate(${angle} 0 0) translate(-60 -39)`}>
            <rect x="39" y="39" width="6" height="116" className="knife__blade" />
            <rect x="75" y="39" width="6" height="116" className="knife__blade" />
            <rect x="34" y="150" width="52" height="8" rx="2" className="knife__bar" />
          </g>
          {closed && <path d="M42 140v-4M78 140v-4" className="knife__spark" />}
        </svg>
        <button
          type="button"
          className="knife__handle"
          style={{ transform: `translateY(${Math.min(Math.max(pos, -0.05), 1.02) * 62}%)` }}
          disabled={disabled || closed}
          aria-label="Throw the switch"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={(e) => {
            // keyboard and plain clicks: a click with no drag throws it
            if (e.detail === 0 || pos < 0.05) commit();
          }}
        >
          <span className="knife__grip" />
        </button>
      </div>
    </div>
  );
}
