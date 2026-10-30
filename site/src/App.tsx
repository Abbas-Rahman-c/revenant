import { useEffect, useRef, useState } from "react";
import { SummoningCircle } from "./components/SummoningCircle";
import { probeDevice, type Sigil } from "./probe";

const REPO = "https://github.com/Abbas-Rahman-c/summoning-circle";
const PREVIEW_MB = 350;

type Phase = "idle" | "summoning" | "ready";

/** Simulated download until the Circle runtime exists. Chunks arrive unevenly, like a real network. */
function useSummonPreview() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function summon() {
    window.clearTimeout(timer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      setPhase("ready");
      return;
    }
    setPhase("summoning");
    setProgress(0);
    let p = 0;
    const step = () => {
      p = Math.min(1, p + 0.015 + Math.random() * 0.045);
      setProgress(p);
      if (p < 1) timer.current = window.setTimeout(step, 60 + Math.random() * 140);
      else setPhase("ready");
    };
    step();
  }

  function banish() {
    window.clearTimeout(timer.current);
    setPhase("idle");
    setProgress(0);
  }

  return { phase, progress, summon, banish };
}

function Hero() {
  const { phase, progress, summon, banish } = useSummonPreview();
  const loaded = Math.round(progress * PREVIEW_MB);

  return (
    <section className="hero">
      <div className="hero__text">
        <h1>Summon AI into your browser.</h1>
        <p className="lede">
          Language, speech, voice and vision models that run on your own device. No server to pay for, and nothing
          you say or show ever leaves your machine.
        </p>
        <pre className="code" aria-label="Example code">
          <code>
            <span className="tok-kw">const</span> mind = <span className="tok-kw">await</span>{" "}
            <span className="tok-fn">summon</span>(<span className="tok-str">"llm"</span>);
          </code>
        </pre>
        <div className="hero__actions">
          {phase === "ready" ? (
            <button className="btn btn--ghost" onClick={banish}>
              Banish it
            </button>
          ) : (
            <button className="btn" onClick={summon} disabled={phase === "summoning"}>
              {phase === "summoning" ? "Summoning…" : "Summon a model"}
            </button>
          )}
          <a className="link" href={REPO}>
            Read the code on GitHub
          </a>
        </div>
        <p className="status" role="status" aria-live="polite">
          {phase === "idle" && "Preview: this plays a simulated download until the runtime is finished."}
          {phase === "summoning" && `Downloading a small language model: ${loaded} of ${PREVIEW_MB} MB`}
          {phase === "ready" && (
            <span className="spirit">Model ready. It would now answer from inside this tab, even offline.</span>
          )}
        </p>
      </div>
      <div className="hero__circle">
        <SummoningCircle progress={progress} ready={phase === "ready"} />
      </div>
    </section>
  );
}

function fmt(n: number | undefined, unit: string, digits = 0) {
  return n === undefined ? "Not shared by this browser" : `${n.toFixed(digits)} ${unit}`;
}

function DeviceSection() {
  const [sigil, setSigil] = useState<Sigil | null>(null);

  useEffect(() => {
    probeDevice().then(setSigil);
  }, []);

  const tierText: Record<Sigil["tier"], string> = {
    tiny: "Tiny models: fast speech-to-text and small helpers, running on the CPU.",
    small: "Small models: a chat model, speech and voice, accelerated by your graphics card.",
    full: "Full set: bigger chat models, vision and voices together, on your graphics card.",
  };

  return (
    <section className="device" aria-labelledby="device-h">
      <h2 id="device-h">What your device can summon</h2>
      <p className="muted">Read just now from your browser. Nothing here was sent anywhere.</p>
      {sigil ? (
        <div className="device__grid">
          <dl className="device__facts">
            <div>
              <dt>WebGPU</dt>
              <dd className={sigil.webgpu ? "ok" : "warn"}>{sigil.webgpu ? "Available" : "Not available"}</dd>
            </div>
            <div>
              <dt>Graphics</dt>
              <dd>{sigil.gpuName ?? (sigil.webgpu ? "Unnamed adapter" : "None found")}</dd>
            </div>
            <div>
              <dt>Memory</dt>
              <dd>{fmt(sigil.memoryGB, "GB or more")}</dd>
            </div>
            <div>
              <dt>Processor threads</dt>
              <dd>{sigil.cores ?? "Not shared by this browser"}</dd>
            </div>
            <div>
              <dt>Storage for models</dt>
              <dd>{fmt(sigil.storageGB, "GB", 1)}</dd>
            </div>
          </dl>
          <div className="device__verdict">
            <p className="device__tier spirit">{sigil.tier === "full" ? "Full" : sigil.tier === "small" ? "Small" : "Tiny"} tier</p>
            <p>{tierText[sigil.tier]}</p>
            <p className="muted small">An early estimate. The finished runtime measures before it loads anything.</p>
          </div>
        </div>
      ) : (
        <p className="muted">Reading your device…</p>
      )}
    </section>
  );
}

function Layers() {
  return (
    <section className="layers" aria-labelledby="layers-h">
      <h2 id="layers-h">Built in three layers</h2>
      <div className="stack">
        <article className="stack__layer stack__layer--apps">
          <h3>The apps</h3>
          <p>Two very different apps built only on the layer below, to prove it bends to any idea.</p>
        </article>
        <article className="stack__layer stack__layer--ritual">
          <h3>The ritual</h3>
          <p>
            A Kiro power and an MCP server that teach coding agents the real model APIs, so they stop inventing ones
            that don't exist.
          </p>
        </article>
        <article className="stack__layer stack__layer--circle">
          <h3>The circle</h3>
          <p>
            One call, <code>summon()</code>, that checks your device, picks a model it can run, loads it off the main
            thread, caches it for offline use and falls back to a lighter one if something fails.
          </p>
        </article>
      </div>
    </section>
  );
}

function Apps() {
  return (
    <section className="apps" aria-labelledby="apps-h">
      <h2 id="apps-h">Two apps, one circle</h2>
      <div className="apps__pair">
        <article className="world world--possessed">
          <h3>Possessed</h3>
          <p className="world__line">Point your camera at a mug. It looks back.</p>
          <p>
            Any object in view gets eyes, a mouth, a personality and a voice, and talks to you. Put two in frame and
            they argue. They remember you next time.
          </p>
          <p className="world__soon">In the works</p>
        </article>
        <article className="world world--threeam">
          <h3>3 AM</h3>
          <p className="world__line">Whisper your dream before it fades.</p>
          <p>
            A dream journal you speak into half asleep. It writes it down, notices what keeps coming back, and draws
            each night into a book only you can open.
          </p>
          <p className="world__soon">In the works</p>
        </article>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="top">
        <span className="wordmark">Summoning Circle</span>
        <a className="link" href={REPO}>
          GitHub
        </a>
      </header>
      <main id="main">
        <Hero />
        <DeviceSection />
        <Layers />
        <Apps />
      </main>
      <footer className="foot">
        <p>
          Built for Kiroween 2026 by Abbas Rahman and Sunaina Babar. <a href={REPO}>MIT licensed</a>.
        </p>
      </footer>
    </>
  );
}
