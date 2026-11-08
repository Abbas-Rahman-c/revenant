import { useCallback, useEffect, useRef, useState } from "react";
import { Creature, Glyph } from "./Creature";
import { KnifeSwitch } from "./KnifeSwitch";
import { Lightning, type LightningHandle, type Point } from "./Lightning";
import { ORGANS, ORGAN_BY_ID, firstWords, type OrganId } from "../organs";
import { playCharge, playClack, playHeartbeat, playStitch, playZap } from "../sound";

type Phase = "idle" | "charging" | "alive";
const CHARGE_MS = 1800;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function TeslaCoil({ side, hot, terminalRef }: { side: "left" | "right"; hot: boolean; terminalRef: React.Ref<SVGCircleElement> }) {
  return (
    <svg className={`coil coil--${side}${hot ? " is-hot" : ""}`} viewBox="0 0 80 260" aria-hidden="true">
      <ellipse cx="40" cy="30" rx="30" ry="12" className="coil__torus" />
      <circle cx="40" cy="22" r="5" className="coil__tip" ref={terminalRef} />
      <rect x="30" y="40" width="20" height="150" className="coil__core" />
      {Array.from({ length: 34 }, (_, i) => (
        <line key={i} x1="28" x2="52" y1={44 + i * 4.3} y2={46 + i * 4.3} className="coil__wind" />
      ))}
      <path d="M14 190h52l8 40H6z" className="coil__base" />
      <rect x="4" y="230" width="72" height="12" rx="2" className="coil__foot" />
    </svg>
  );
}

function Heartbeat() {
  return (
    <svg className="ecg" viewBox="0 0 600 60" preserveAspectRatio="none" aria-hidden="true">
      <path
        pathLength={100}
        d="M0 34h80l8-6 8 6h20l6-26 8 46 6-20h18l10-4 10 4h90l8-6 8 6h20l6-26 8 46 6-20h18l10-4 10 4h90l8-6 8 6h20l6-26 8 46 6-20h18l10-4 10 4h48"
      />
    </svg>
  );
}

export function Lab() {
  const [parts, setParts] = useState<Set<OrganId>>(new Set());
  const [flying, setFlying] = useState<OrganId | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [loadStep, setLoadStep] = useState(0); // 0..1 across all attached parts
  const [flash, setFlash] = useState(false);

  const creatureRef = useRef<SVGSVGElement>(null);
  const leftTip = useRef<SVGCircleElement>(null);
  const rightTip = useRef<SVGCircleElement>(null);
  const lightning = useRef<LightningHandle>(null);
  const jarRefs = useRef<Partial<Record<OrganId, HTMLButtonElement | null>>>({});
  const floater = useRef<HTMLDivElement>(null);

  // heartbeat sound while alive
  useEffect(() => {
    if (phase !== "alive") return;
    playHeartbeat();
    const id = window.setInterval(playHeartbeat, 1100);
    return () => window.clearInterval(id);
  }, [phase]);

  const toggle = useCallback(
    async (id: OrganId) => {
      if (phase !== "idle" || flying) return;
      if (parts.has(id)) {
        setParts((p) => {
          const n = new Set(p);
          n.delete(id);
          return n;
        });
        return;
      }
      const jar = jarRefs.current[id];
      const svg = creatureRef.current;
      const fl = floater.current;
      if (jar && svg && fl && !reducedMotion()) {
        // fly the part from its jar to its socket along a curved path
        const from = jar.querySelector(".jar__glyph")!.getBoundingClientRect();
        const box = svg.getBoundingClientRect();
        const s = ORGAN_BY_ID[id].socket;
        const to = { x: box.left + (s.x / 320) * box.width, y: box.top + (s.y / 520) * box.height };
        const fx = from.left + from.width / 2;
        const fy = from.top + from.height / 2;
        setFlying(id);
        fl.style.left = `${fx}px`;
        fl.style.top = `${fy}px`;
        const dx = to.x - fx;
        const dy = to.y - fy;
        const lift = -Math.min(120, Math.abs(dx) * 0.35);
        await fl.animate(
          [
            { transform: "translate(-50%, -50%) translate(0px, 0px) scale(1) rotate(0deg)", offset: 0 },
            { transform: `translate(-50%, -50%) translate(${dx * 0.5}px, ${dy * 0.5 + lift}px) scale(1.15) rotate(-8deg)`, offset: 0.5 },
            { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.9) rotate(0deg)`, offset: 1 },
          ],
          { duration: 560, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" },
        ).finished;
        setFlying(null);
      }
      setParts((p) => new Set(p).add(id));
      playStitch();
      window.setTimeout(playStitch, 160);
      window.setTimeout(playStitch, 320);
    },
    [phase, parts, flying],
  );

  const reanimate = useCallback(async () => {
    if (phase !== "idle" || parts.size === 0) return;
    playClack();
    const reduce = reducedMotion();
    setPhase("charging");
    setLoadStep(0);
    const stop = playCharge(CHARGE_MS / 1000);
    // preview: fill the load bars over the charge time
    await new Promise<void>((resolve) => {
      if (reduce) {
        setLoadStep(1);
        return window.setTimeout(resolve, 300);
      }
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / CHARGE_MS, 1);
        setLoadStep(t);
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    stop();

    const terminals = creatureRef.current ? Array.from(creatureRef.current.querySelectorAll("[data-terminal]")) : [];
    const centre = (el: Element | null): Point | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const l = centre(leftTip.current);
    const r = centre(rightTip.current);
    const tl = centre(terminals[0] ?? null);
    const tr = centre(terminals[1] ?? null);
    if (!reduce && l && r && tl && tr && lightning.current) {
      playZap();
      setFlash(true);
      window.setTimeout(() => setFlash(false), 180);
      await lightning.current.strike([
        [l, tl],
        [r, tr],
      ]);
    } else {
      playZap();
    }
    setPhase("alive");
  }, [phase, parts]);

  function unplug() {
    setPhase("idle");
    setLoadStep(0);
  }

  const attached = ORGANS.filter((o) => parts.has(o.id));
  const totalMB = attached.reduce((s, o) => s + o.approxMB, 0);
  const hot = phase !== "idle";

  return (
    <section className={`lab lab--${phase}`} aria-labelledby="lab-h">
      <div className="lab__copy">
        <h1 id="lab-h">Stitch a mind into your browser.</h1>
        <p className="lede">
          Eyes, ears, a brain, a voice and a memory. Five AI models built on five different web technologies, sewn
          into one creature that lives entirely on your device.
        </p>

        <ol className="steps">
          <li className={parts.size > 0 ? "is-done" : ""}>Pick parts from the jars to stitch them on.</li>
          <li className={phase !== "idle" ? "is-done" : ""}>Throw the switch.</li>
        </ol>

        <div className="lab__switch">
          <KnifeSwitch disabled={parts.size === 0} closed={phase !== "idle"} onThrow={reanimate} />
          <div className="lab__switch-text" aria-live="polite">
            {phase === "idle" && (
              <>
                <p className="readout">
                  {parts.size} of 5 parts stitched
                  {parts.size > 0 && <span className="readout__dim"> (about {totalMB} MB)</span>}
                </p>
                <p className="hint">
                  {parts.size === 0 ? "The switch is dead until a part is stitched on." : "Drag the handle down, or press it."}
                </p>
              </>
            )}
            {phase === "charging" && <p className="readout readout--hot">Charging the coils…</p>}
            {phase === "alive" && (
              <>
                <p className="readout readout--hot">It's alive.</p>
                <button type="button" className="btn-quiet" onClick={unplug}>
                  Unplug it
                </button>
              </>
            )}
          </div>
        </div>
        <p className="note">
          Preview. Loading is simulated until the runtime is finished; the five parts are the real models we are wiring
          up next.
        </p>
      </div>

      <div className="lab__stage">
        <TeslaCoil side="left" hot={hot} terminalRef={leftTip} />
        <div className="lab__slab">
          <Creature ref={creatureRef} parts={parts} alive={phase === "alive"} charging={phase === "charging"} />
        </div>
        <TeslaCoil side="right" hot={hot} terminalRef={rightTip} />

        <div className="lab__monitor" aria-live="polite">
          {phase === "charging" &&
            attached.map((o, i) => {
              const share = 1 / attached.length;
              const local = Math.min(Math.max((loadStep - i * share) / share, 0), 1);
              return (
                <div key={o.id} className="load">
                  <span className="load__name">{o.name}</span>
                  <span className="load__bar">
                    <span style={{ transform: `scaleX(${local})` }} />
                  </span>
                  <span className="load__mb">{Math.round(local * o.approxMB)} MB</span>
                </div>
              );
            })}
          {phase === "alive" && (
            <>
              <Heartbeat />
              <p className="subtitle">
                <span>{firstWords(parts)}</span>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="lab__jars" role="group" aria-label="Specimen jars">
        {ORGANS.map((o) => {
          const on = parts.has(o.id) || flying === o.id;
          return (
            <button
              key={o.id}
              type="button"
              ref={(el) => {
                jarRefs.current[o.id] = el;
              }}
              className={`jar${on ? " is-empty" : ""}`}
              aria-pressed={parts.has(o.id)}
              disabled={phase !== "idle"}
              onClick={() => toggle(o.id)}
            >
              <svg className="jar__svg" viewBox="0 0 90 96" aria-hidden="true">
                <path d="M22 10h46v8l6 6v58a8 8 0 0 1-8 8H24a8 8 0 0 1-8-8V24l6-6z" className="jar__glass" />
                <path d={`M17 ${on ? 76 : 40}h56v42a8 8 0 0 1-8 8H25a8 8 0 0 1-8-8z`} className="jar__fluid" />
                <rect x="20" y="4" width="50" height="9" rx="2" className="jar__lid" />
                <path d="M26 30v40" className="jar__shine" />
              </svg>
              <svg className="jar__glyph" viewBox="-40 -25 80 50" aria-hidden="true" style={{ opacity: on ? 0 : 1 }}>
                <Glyph id={o.id} alive={false} />
              </svg>
              <span className="jar__label">
                <span className="jar__name">{o.name}</span>
                <span className="jar__does">{parts.has(o.id) ? "Stitched on. Click to remove." : o.does}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="floater" ref={floater} aria-hidden="true" style={{ opacity: flying ? 1 : 0 }}>
        {flying && (
          <svg viewBox="-40 -25 80 50">
            <Glyph id={flying} alive={false} />
          </svg>
        )}
      </div>
      <div className={`flash${flash ? " is-on" : ""}`} aria-hidden="true" />
      <Lightning ref={lightning} />
    </section>
  );
}
