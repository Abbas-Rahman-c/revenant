import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Glyph } from "./Creature";
import type { CreatureSceneHandle } from "./CreatureBody";
import { KnifeSwitch } from "./KnifeSwitch";
import { ORGANS, firstWords, type OrganId } from "../organs";
import { playCharge, playClack, playHeartbeat, playStitch, playZap, speak } from "../sound";

// three.js is large, so the 3D creature loads in its own chunk
const CreatureBody = lazy(() => import("./CreatureBody"));

type Phase = "idle" | "charging" | "alive";
const CHARGE_MS = 1800;
/** Matches the CSS build sequence: bones, muscle, flesh, seams, clamps. */
const BUILD_MS = 3900;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  const [speaking, setSpeaking] = useState(false);
  const [stageRoot, setStageRoot] = useState<HTMLElement | null>(null);
  useEffect(() => setStageRoot(document.getElementById("stage-root")), []);
  const [intro] = useState(() => !reducedMotion());
  const [built, setBuilt] = useState(!intro);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const go = () => setEntered(true);
    window.addEventListener("lab:enter", go);
    return () => window.removeEventListener("lab:enter", go);
  }, []);

  const creatureRef = useRef<CreatureSceneHandle>(null);
  const jarRefs = useRef<Partial<Record<OrganId, HTMLButtonElement | null>>>({});
  const floater = useRef<HTMLDivElement>(null);

  // the body builds itself once, on first load
  useEffect(() => {
    if (built || !entered) return;
    const t = window.setTimeout(() => setBuilt(true), BUILD_MS);
    return () => window.clearTimeout(t);
  }, [built, entered]);

  // heartbeat sound while alive
  useEffect(() => {
    if (phase !== "alive") return;
    playHeartbeat();
    const id = window.setInterval(playHeartbeat, 1100);
    return () => window.clearInterval(id);
  }, [phase]);

  const toggle = useCallback(
    async (id: OrganId) => {
      if (phase !== "idle" || flying || !built) return;
      if (parts.has(id)) {
        setParts((p) => {
          const n = new Set(p);
          n.delete(id);
          return n;
        });
        return;
      }
      const jar = jarRefs.current[id];
      const fl = floater.current;
      const to = creatureRef.current?.socket(id) ?? null;
      if (jar && to && fl && !reducedMotion()) {
        // fly the part from its jar to its socket along a curved path
        const from = jar.querySelector(".jar__glyph")!.getBoundingClientRect();
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
    [phase, parts, flying, built],
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

    playZap();
    if (!reduce && creatureRef.current) {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 180);
      await creatureRef.current.strike();
    }
    setPhase("alive");
    // its first words, once it has a brain to think them and a voice to say them
    if (parts.has("brain") && parts.has("voice")) {
      window.setTimeout(() => speak(firstWords(parts), () => setSpeaking(true), () => setSpeaking(false)), 700);
    }
  }, [phase, parts]);

  function unplug() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setPhase("idle");
    setLoadStep(0);
  }

  const attached = ORGANS.filter((o) => parts.has(o.id));
  const totalMB = attached.reduce((s, o) => s + o.approxMB, 0);

  return (
    <section className={`lab lab--${phase}${built ? "" : " is-building"}${intro ? " has-intro" : ""}${entered ? " is-entered" : ""}`} aria-labelledby="lab-h">
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
          <KnifeSwitch disabled={parts.size === 0 || !built} closed={phase !== "idle"} onThrow={reanimate} />
          <div className="lab__switch-text" aria-live="polite">
            {phase === "idle" && (
              <>
                <p className="readout">
                  {parts.size} of 5 parts stitched
                  {parts.size > 0 && <span className="readout__dim"> (about {totalMB} MB)</span>}
                </p>
                <p className="hint">
                  {!built
                    ? "The body is still being put together…"
                    : parts.size === 0
                      ? "The switch is dead until a part is stitched on."
                      : "Drag the handle down, or press it."}
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
        {stageRoot &&
          createPortal(
            <Suspense fallback={null}>
              <CreatureBody
                ref={creatureRef}
                parts={parts}
                alive={phase === "alive"}
                charging={phase === "charging"}
                intro={intro}
                speaking={speaking}
                entered={entered}
              />
            </Suspense>,
            stageRoot,
          )}

        <div className="lab__monitor" aria-live="polite">
          {!built && entered && (
            <p className="assembly" aria-label="Assembling the body">
              <span>Bones</span>
              <span>Muscle</span>
              <span>Flesh</span>
              <span>Sutures</span>
            </p>
          )}
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
              disabled={phase !== "idle" || !built}
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
    </section>
  );
}
