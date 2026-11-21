// Test bench: summon each part through the public API and exercise every handle method.

import { probeDevice, summon, type HandleFor, type PartId, type Progress, type Tier } from "../src/index.js";

const $ = <T extends HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;
const fmtMB = (b?: number) => (b === undefined ? "" : `${(b / 1048576).toFixed(1)} MB`);

probeDevice().then((s) => {
  $<HTMLElement>(document, "#sigil").textContent = `${s.tier} tier (${s.facts.webgpu ? "WebGPU" : "no WebGPU"}${s.facts.gpuName ? `, ${s.facts.gpuName}` : ""})${s.reasons.length ? ` · ${s.reasons.join(", ")}` : ""}`;
});

const CONTROLS: Record<PartId, string> = {
  brain: `<div class="row"><input data-in value="You just woke up on a lab table. Say hello in one sentence." /><button data-go disabled>Ask</button></div>`,
  ears: `<div class="row"><button data-go disabled>Hold to talk</button><span data-hint></span></div>`,
  voice: `<div class="row"><input data-in value="It's alive. I can hear the rain. Who are you?" /><button data-go disabled>Speak</button></div>`,
  memory: `<div class="row"><input data-in value="My name is Abbas and I love storms" /><button data-go disabled>Remember</button></div>
           <div class="row"><input data-q value="what weather do I like" /><button data-recall disabled>Recall</button><button data-forget disabled>Forget all</button></div>`,
};

function panel(part: PartId) {
  const el = document.createElement("section");
  el.innerHTML = `<h2>${part} <small data-state>not summoned</small></h2>
    <div class="row">
      <select data-tier><option>auto</option><option>full</option><option>small</option><option>tiny</option></select>
      <button data-summon>Summon</button><button data-abort disabled>Abort</button><button data-banish disabled>Banish</button>
    </div>
    <div class="bar"><i></i></div><small data-prog></small>
    ${CONTROLS[part]}
    <pre data-log></pre>`;
  $<HTMLElement>(document, "#parts").append(el);

  const log = (s: string, bad = false) => {
    const pre = $<HTMLPreElement>(el, "[data-log]");
    const line = document.createElement("div");
    line.textContent = s;
    if (bad) line.className = "err";
    pre.append(line);
    pre.scrollTop = pre.scrollHeight;
  };
  const btns = () => el.querySelectorAll<HTMLButtonElement>("[data-go],[data-recall],[data-forget]");
  let handle: HandleFor<PartId> | null = null;
  let ac: AbortController | null = null;

  const setLoaded = (h: HandleFor<PartId> | null) => {
    handle = h;
    btns().forEach((b) => (b.disabled = !h));
    $<HTMLButtonElement>(el, "[data-banish]").disabled = !h;
    $<HTMLElement>(el, "[data-state]").textContent = h ? `${h.tier} tier${"model" in h ? ` · ${h.model}` : ""}` : "not summoned";
  };

  $<HTMLButtonElement>(el, "[data-summon]").onclick = async () => {
    handle?.banish();
    setLoaded(null);
    ac = new AbortController();
    $<HTMLButtonElement>(el, "[data-abort]").disabled = false;
    const t0 = performance.now();
    const tier = $<HTMLSelectElement>(el, "[data-tier]").value as Tier | "auto";
    try {
      const h = await summon(part, {
        tier,
        signal: ac.signal,
        onAttempt: (t) => log(`trying the ${t} tier`),
        onProgress: (p: Progress) => {
          $<HTMLElement>(el, ".bar i").style.width = `${Math.round(p.fraction * 100)}%`;
          $<HTMLElement>(el, "[data-prog]").textContent =
            `${p.stage} ${Math.round(p.fraction * 100)}% ${p.totalBytes ? `${fmtMB(p.loadedBytes)} / ${fmtMB(p.totalBytes)}` : ""}${p.fromCache ? " · from cache" : ""}`;
        },
      });
      log(`ready in ${Math.round(performance.now() - t0)} ms`);
      setLoaded(h);
    } catch (e) {
      const err = e as { code: string; message: string };
      log(`${err.code}: ${err.message}`, true);
    } finally {
      $<HTMLButtonElement>(el, "[data-abort]").disabled = true;
    }
  };
  $<HTMLButtonElement>(el, "[data-abort]").onclick = () => ac?.abort();
  $<HTMLButtonElement>(el, "[data-banish]").onclick = () => {
    handle?.banish();
    setLoaded(null);
    log("banished");
  };

  const run = async (f: () => Promise<void>) => {
    try {
      await f();
    } catch (e) {
      const err = e as { code: string; message: string };
      log(`${err.code}: ${err.message}`, true);
    }
  };
  const input = () => $<HTMLInputElement>(el, "[data-in]")?.value ?? "";

  if (part === "brain") {
    $<HTMLButtonElement>(el, "[data-go]").onclick = () =>
      run(async () => {
        const h = handle as HandleFor<"brain">;
        const t0 = performance.now();
        let first = 0;
        let text = "";
        for await (const t of h.ask([
          { role: "system", content: "You are a creature just brought to life. Answer in one or two short sentences." },
          { role: "user", content: input() },
        ])) {
          if (!first) first = performance.now() - t0;
          text += t;
        }
        log(`${text}\n(first token ${Math.round(first)} ms, total ${Math.round(performance.now() - t0)} ms)`);
      });
  }
  if (part === "voice") {
    $<HTMLButtonElement>(el, "[data-go]").onclick = () =>
      run(async () => {
        const h = handle as HandleFor<"voice">;
        const ctx = new AudioContext();
        let at = ctx.currentTime;
        const t0 = performance.now();
        for await (const a of h.speakStream(input())) {
          const dur = a.samples.length / a.sampleRate;
          log(`"${a.sentence}" ${dur.toFixed(2)} s of audio at ${Math.round(performance.now() - t0)} ms`);
          const buf = ctx.createBuffer(1, a.samples.length, a.sampleRate);
          buf.getChannelData(0).set(a.samples);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          at = Math.max(at, ctx.currentTime);
          src.start(at);
          at += dur;
        }
      });
  }
  if (part === "memory") {
    $<HTMLButtonElement>(el, "[data-go]").onclick = () =>
      run(async () => {
        const id = await (handle as HandleFor<"memory">).remember(input());
        log(`remembered #${id}`);
      });
    $<HTMLButtonElement>(el, "[data-recall]").onclick = () =>
      run(async () => {
        const q = $<HTMLInputElement>(el, "[data-q]").value;
        const hits = await (handle as HandleFor<"memory">).recall(q, 3);
        log(hits.length ? hits.map((m) => `${m.score.toFixed(3)}  ${m.text}`).join("\n") : "nothing remembered");
      });
    $<HTMLButtonElement>(el, "[data-forget]").onclick = () =>
      run(async () => {
        await (handle as HandleFor<"memory">).forget();
        log("forgot everything");
      });
  }
  if (part === "ears") {
    const go = $<HTMLButtonElement>(el, "[data-go]");
    let stop: (() => Promise<Float32Array>) | null = null;
    go.onpointerdown = () =>
      run(async () => {
        stop = await record();
        $<HTMLElement>(el, "[data-hint]").textContent = "listening…";
      });
    go.onpointerup = () =>
      run(async () => {
        if (!stop) return;
        const samples = await stop();
        stop = null;
        $<HTMLElement>(el, "[data-hint]").textContent = "";
        const t0 = performance.now();
        const text = await (handle as HandleFor<"ears">).transcribe(samples);
        log(`"${text}" (${(samples.length / 16000).toFixed(1)} s of speech, ${Math.round(performance.now() - t0)} ms)`);
      });
  }
}

/** Records from the mic and returns 16 kHz mono samples when stopped. */
async function record(): Promise<() => Promise<Float32Array>> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const ctx = new AudioContext({ sampleRate: 16000 });
  const src = ctx.createMediaStreamSource(stream);
  const chunks: Float32Array[] = [];
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  src.connect(proc);
  proc.connect(ctx.destination);
  return async () => {
    proc.disconnect();
    src.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    await ctx.close();
    const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  };
}

(["brain", "voice", "ears", "memory"] as PartId[]).forEach(panel);
