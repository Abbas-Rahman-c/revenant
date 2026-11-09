# Backend plan: making the creature real

**Status on 8 Nov 2026.** The lab frontend is finished and live in `site/`, but every model load in it is simulated. This plan covers how we wire real browser AI into it, and everything left to fix before submitting on **Fri 4 Dec, 2:00 PM PT (Sat 5 Dec, 3:00 AM Pakistan)**.

> **Decided (8 Nov):** we build **one creature app** (the lab becomes real) instead of the two separate apps (Possessed and 3 AM) from the old Skeleton Crew plan. Frankenstein is judged on one app stitched from many technologies, and one great creature beats two half-finished apps. The best ideas from the old apps survive as creature features: talking back through the camera comes from Possessed, and remembering you comes from 3 AM.

---

## 1. Where we are

| Piece | State |
|---|---|
| Landing and lab UI (`site/`) | ✅ Built: jars, sutures, switch, lightning, subtitles, gauges, sound |
| Device probe | 🟡 An early version exists in `site/src/probe.ts`. The proper one is Task 01 (Sunaina). |
| Runtime (`circle/`) | ❌ Not started |
| Real models | ❌ None loaded yet: sizes and progress are simulated |
| Conversation loop (camera, mic, speech) | ❌ Not started |
| Kiro specs, hooks, MCP, power | ❌ Only steering docs exist. **This is the biggest risk** (see section 9). |
| Deployment | ❌ Not deployed |

---

## 2. Architecture

Everything runs in the visitor's browser. There is no server of ours.

```
┌────────────────────────── browser tab ───────────────────────────┐
│                                                                   │
│  site/ (React UI)                                                 │
│    Lab: jars, switch, lightning, subtitles                        │
│    Talk mode: camera preview, mic button, chat log                │
│            │                                                      │
│            ▼  public API only                                     │
│  circle/ (the runtime)                                            │
│    sigil      what this device can run (Task 01)                  │
│    registry   verified model per part and tier                    │
│    summon()   load a part, report progress, return a handle       │
│    pool       one Web Worker per part, a message protocol         │
│            │                                                      │
│            ▼                                                      │
│  Workers, one per part                                            │
│    brain  ─ WebLLM on WebGPU        (fallback: smaller model)     │
│    ears   ─ Transformers.js Whisper (WASM or WebGPU)              │
│    voice  ─ Transformers.js / Kokoro TTS                          │
│    memory ─ Transformers.js embeddings + IndexedDB vector store   │
│    eyes   ─ MediaPipe Object Detector (runs on the main thread    │
│             with the video element; light enough)                 │
│            │                                                      │
│            ▼                                                      │
│  Browser storage: model files in Cache API / OPFS, memories in    │
│  IndexedDB. Model files download once from Hugging Face / the     │
│  MediaPipe CDN. Camera, mic and conversation never leave.         │
└───────────────────────────────────────────────────────────────────┘
```

### Parts to model kinds

| Part | Kind | Library (to verify) | Candidate model (to verify) |
|---|---|---|---|
| Brain | `llm` | `@mlc-ai/web-llm` | a 0.5B to 1.5B instruct model, 4-bit |
| Ears | `speech-to-text` | `@huggingface/transformers` | Whisper tiny or base, English |
| Voice | `tts` | `kokoro-js` or `@huggingface/transformers` | Kokoro 82M |
| Memory | `embeddings` | `@huggingface/transformers` | all-MiniLM-L6-v2 or bge-small |
| Eyes | `vision` | `@mediapipe/tasks-vision` | EfficientDet-Lite0 object detector |

**Nothing in the two right-hand columns is confirmed.** Our own rule (`.kiro/steering/local-ai.md`): run each one in a real browser first, record the exact version, model ID, size and license there, and only then write loader code.

---

## 3. The contract between UI and runtime

The UI may only import from `circle`'s public entry point. This is the interface both of us build against:

```ts
type PartId = "brain" | "eyes" | "ears" | "voice" | "memory";

type Progress = {
  part: PartId;
  stage: "checking" | "downloading" | "warming-up" | "ready";
  loadedBytes: number;
  totalBytes: number;      // real total from the model files, not a guess
  fromCache: boolean;      // true when it loaded offline from storage
};

summon(part: PartId, opts?: {
  tier?: "auto" | "tiny" | "small" | "full";
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
}): Promise<Handle>;       // rejects with a CircleError

// What each handle can do
brain.ask(messages, { signal }): AsyncIterable<string>      // streamed tokens
ears.transcribe(audio: Float32Array /* 16 kHz mono */): Promise<string>
voice.speak(text: string): Promise<{ samples: Float32Array; sampleRate: number }>
memory.remember(text: string): Promise<void>
memory.recall(query: string, k?: number): Promise<string[]>
eyes.detect(frame: HTMLVideoElement): Array<{ label: string; score: number }>
handle.banish(): void                                        // unload, free memory

type CircleError = { code: "NO_WEBGPU" | "OUT_OF_MEMORY" | "LOW_STORAGE"
                         | "DOWNLOAD_FAILED" | "MODEL_LOAD_FAILED" | "ABORTED";
                     part: PartId; message: string };
```

**Worker message protocol** (`circle/src/workers/protocol.ts`):
`{ id, type: "load" | "run" | "abort", part, payload }` in, and `{ id, type: "progress" | "result" | "chunk" | "error", payload }` out. Audio and embeddings go across as transferable `ArrayBuffer`s, never copied.

---

## 4. Wiring the lab

### 4.1 Throwing the switch (replaces the simulation in `site/src/components/Lab.tsx`)

1. `probeDevice()` gives the tier.
2. For each stitched part, `summon(part, { onProgress })`. The load bars bind to `loadedBytes / totalBytes`, and the MB numbers become real.
3. Brain and the others load **in parallel**; brain is the slowest, so start it first.
4. If a part fails: retry once with the next lighter tier. If that also fails, the part's bar turns `--blood` with a plain message ("Voice didn't fit in memory. The creature will answer in subtitles.") and the rest carry on.
5. Lightning strikes when every part has either loaded or failed. Brain failing means no reanimation: the creature twitches and the message says why.
6. A second visit loads from cache. Show "Loaded from storage, works offline" (the offline seal).

The "Preview" note and `approxMB` in `organs.ts` are removed once this works.

### 4.2 Talk mode (after "It's alive")

A **Talk to it** button opens the conversation. Each turn:

```
 mic (push-to-talk) ──► ears.transcribe ──► text
 camera every 600 ms ─► eyes.detect ─────► "I see: mug, laptop"
 memory.recall(text) ─────────────────────► past facts about you
            all three ──► brain.ask(system prompt + context) ──► streamed words
                                  │                               │
                                  ▼                               ▼
                          subtitles (arc color)          voice.speak per sentence
                                                                  │
                                                          Web Audio playback
 memory.remember("visitor said …")  after each turn
```

- **The system prompt** gives the creature its personality (newly woken, curious, slightly theatrical, short answers). It must say it runs on the visitor's device. It must never claim to be any film character.
- **Speak sentence by sentence**, so the voice starts before the brain finishes.
- **Missing parts change the experience, and that's the fun:**

| Missing | What happens |
|---|---|
| Ears | A text box replaces the mic |
| Voice | Subtitles only; the mouth stays stitched |
| Eyes | No camera; it says it can't see |
| Memory | It forgets you on reload, and says so |
| Brain | No talking at all. Brain is required to throw the switch for real. |

- **Permissions:** ask for the camera or mic only when Talk mode opens, never on page load. Denied means a clear message plus the text-box fallback.
- **First words** (`firstWords()` in `organs.ts`) stay as the instant line at the moment of waking; the brain takes over from the first real turn.

---

## 5. Hosting and headers

- **Host:** Cloudflare Pages or Vercel, both free. **Not GitHub Pages**, because we need custom headers.
- **Cross-origin isolation:** multi-threaded WebAssembly (used by Transformers.js and possibly WebLLM) needs `SharedArrayBuffer`, which needs these two headers on every page:
  ```
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp   (or credentialless; verify which works with the model CDNs)
  ```
  Test early, because these headers can block model downloads from other domains.
- **Model hosting:** load from Hugging Face and the MediaPipe CDN directly (free, cached by the browser). Fallback if the headers fight us: copy the small models into our own static hosting.

---

## 6. Copy and claims to fix (honesty patches)

- [ ] The site and steering say the page "makes no third-party requests". **Once real models load, that's false**: models download from Hugging Face. New wording: *"Models download once, then run offline. Your camera, voice and words never leave this tab."*
- [ ] Remove "Preview… simulated" notes only when loading is real.
- [ ] The gauges' tier text ("Small creature…") must match the real tier rules from Task 01.
- [ ] Credit every model and library with its license in the README and on the site footer.

---

## 7. Kiro work (20% of the score)

| Item | What | When |
|---|---|---|
| Specs | `device-sigil` (Task 01), `circle-runtime`, `worker-protocol`, one spec per part, `talk-mode` | before writing each piece |
| Steering | fill `local-ai.md` with verified models; keep design and product current | ongoing |
| Hooks | run sigil and runtime tests on save; registry guard (model ID must be in `local-ai.md`); keep the circle core lean | week 1 |
| Property tests | tier choice (Task 01); worker protocol: every request gets exactly one result or error; fallback always ends in a lighter tier or a typed error | weeks 1–2 |
| MCP server (`circle-mcp/`) | `probe_device` (headless Chromium + WebGPU), `list_parts` (verified entries), `benchmark_part` | week 2 |
| Kiro power (`power/`) | package the steering, hooks and MCP so others can build their own creature | week 3 |
| Notes | `planning/kiro-notes.md`, the raw material for the write-up | ongoing |

---

## 8. Testing

- **Unit and property tests** (Vitest + fast-check) in `circle/`.
- **Browser smoke test** (Playwright, Chromium with WebGPU enabled): open the site, stitch brain + ears, throw the switch, wait for "It's alive", send one typed message, expect a streamed reply.
- **Real devices:** our two laptops, one mid-range Android phone, plus Safari and Firefox (they should fall back cleanly).
- **Offline check:** load once, turn on airplane mode, reload, talk.

---

## 9. Patch list: everything left

### Must decide now
- [x] **One creature app vs two apps.** This plan assumes one.

### Repo clean-up (after the decision)
- [x] `README.md`: still says Skeleton Crew and lists the two apps. Rewrite for Frankenstein.
- [x] `.kiro/steering/product.md` and `structure.md`: still list `apps/possessed` and `apps/three-am`.
- [x] Delete `apps/possessed/` and `apps/three-am/`, or repurpose them.
- [x] `planning/CONCEPT.md` and `planning/KIRO_KICKOFF.md`: Skeleton Crew references. Update or mark as superseded.
- [x] `planning/Frontend_Design_Brief.pdf`: outdated (three old directions) and mentions superhero films. Remove it from the repo.

### Biggest risk: Kiro usage
- [ ] So far, the site was built outside Kiro and `.kiro/specs/` is empty. Judges check this, and "insufficient use of Kiro" can disqualify. **From now on, build everything in `circle/`, `circle-mcp/` and `power/` through Kiro specs**, and consider moving future site changes through Kiro too.

### Build
- [ ] Task 01: device sigil (Sunaina)
- [ ] Verify one model per part in the browser and record it in `local-ai.md`
- [ ] Worker pool and protocol
- [ ] `summon()` with real progress, cache detection and fallback
- [ ] Five part loaders
- [ ] Wire the lab's switch to the real loads (section 4.1)
- [ ] Talk mode: push-to-talk, camera, chat log, sentence-by-sentence speech (section 4.2)
- [ ] Error and empty states: camera or mic denied, no WebGPU, out of storage, download failed, offline first visit
- [ ] Swap `site/src/probe.ts` for the sigil from `circle`
- [ ] COOP/COEP headers and deployment to Cloudflare Pages or Vercel
- [ ] `circle-mcp` and the Kiro power
- [ ] Honesty patches (section 6)

### Ship
- [ ] Both of us submit the Kiro credit form (deadline 1 Dec)
- [ ] Demo video under 3 minutes: stitch, throw, alive, talk, airplane mode
- [ ] Devpost text, the Kiro usage write-up, Best Student Project details
- [ ] Social post starting with `#KiroweenHackathon26`; blog post mentioning Kiroween 2026
- [ ] Submit on **Thu 3 Dec**, a day early

---

## 10. Timeline

| Week | Abbas | Sunaina |
|---|---|---|
| **Nov 9–15** | Verify brain + ears models; worker protocol spec; `summon()` core | Task 01 sigil; verify memory + voice models |
| **Nov 16–22** | Brain + ears loaders; wire the switch to real loads | Voice + memory loaders; eyes with MediaPipe |
| **Nov 23–27** | Talk mode loop; deploy with headers; `circle-mcp` | Error states; mobile pass; Playwright smoke test; Kiro power |
| **Nov 28–Dec 3** | Kiro write-up; README; final fixes | Video; Devpost page; social + blog |
| **Dec 3** | **Submit** | |

**Cut order if we run late:** eyes first (talk works without them), then memory, then the Kiro power (keep the MCP server). Never cut brain, ears, voice, the Kiro specs or the video.
