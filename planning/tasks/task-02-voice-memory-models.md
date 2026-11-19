# Task 02: Verify the voice and memory models

**Owner:** Sunaina · **Dates:** Fri 20 to Mon 23 November · **Area:** `circle/playground/` and `.kiro/steering/local-ai.md` · **Build it in:** Kiro

---

## Part 1 review (done, nice work)

Device sigil merged: probe and tier logic, 11 tests passing, strict typecheck clean, spec and hook in `.kiro/`, verified browser APIs written into `local-ai.md`. Three small carry-overs first (about an hour):

1. **Add the 5 property-based tests.** `fast-check` is installed but no test uses it yet. Add them to `tier.test.ts`: more never hurts, no WebGPU means no GPU tiers, fits the device, deterministic, honest reasons. Kiro and judges both look for these.
2. **Pin `fast-check` exactly.** `circle/package.json` has `"^3.20.0"`; our rule is exact versions (no `^` or `~`).
3. **Switch to `adapter.info?.isFallbackAdapter`.** You already flagged this in `local-ai.md`; make the change and keep a fallback to the old property for older browsers.

---

## What and why

The creature needs a **voice** (text to speech) and a **memory** (text embeddings for remembering the visitor). Before anyone writes loader code, we prove which real models run in the browser, how big they are, how fast they are and what their licenses allow. That is our project rule: **no guessed model IDs or APIs.**

Right now the site uses the browser's built-in speech voice as a stand-in. This task picks what replaces it.

## Candidates (verify every detail; nothing here is confirmed)

| Part | Library (checked on npm, 20 Nov) | Candidate model | Fallback |
|---|---|---|---|
| Voice | `kokoro-js@1.2.1` (Apache-2.0) | Kokoro 82M, ONNX build | SpeechT5 via Transformers.js |
| Memory | `@huggingface/transformers@4.3.2` (Apache-2.0) | all-MiniLM-L6-v2 (384-dim embeddings) | bge-small-en-v1.5 |

For each one: read the official README or model card, find the **exact model ID** the library expects, check the **model weights' license** (it can differ from the library's), and note which backends it supports (WebGPU, WebAssembly) and which precisions (fp32, q8, q4).

## What to build

A small test page that is **not** part of the site: `circle/playground/` (a Vite page, its own `index.html`). Two panels:

- **Voice:** a "Load" button with real download progress, a text box, and "Speak". It plays the audio and shows the timings.
- **Memory:** "Load", then embed three sentences and show their cosine similarities (for example: "I love the rain", "Storms make me happy", "My laptop is broken"; the first two should score closer).

Add a script to `circle/package.json`: `"playground": "vite circle/playground"` (or similar), so it runs with `npm run playground -w circle`.

## What to measure

Run on your laptop in Chrome. Record each number from DevTools, not estimates.

| Measure | Voice | Memory |
|---|---|---|
| Download size (Network tab, first load) | | |
| First load time (click to ready) | | |
| Second load time (from cache) | | |
| Speed | time to speak a 12-word sentence | milliseconds per sentence |
| Backend actually used | WebGPU or WebAssembly | |
| Peak memory (Performance or Memory tab) | | |
| Works offline after first load? | | |
| Needs cross-origin isolation headers? | | |

Also try each one with WebGPU turned off (`chrome://flags`, or the library's WebAssembly option) so we know the fallback works.

## What to write

For each model, a complete entry in `.kiro/steering/local-ai.md` using the template at the top of that file: library and exact version, model ID, download size, tier, license, the date and machine it was verified on, a minimal working snippet, and gotchas.

Then a short **decision** under each entry: which precision and backend we use for each tier (`tiny`, `small`, `full`), and the fallback if loading fails.

## How to do it in Kiro

1. Pull `main`, create branch `feature/voice-memory-models`.
2. **Spec mode**, paste:
   > Create a spec called voice-memory-models from planning/tasks/task-02-voice-memory-models.md. The deliverable is a playground page in circle/playground/ and two verified entries in .kiro/steering/local-ai.md. Requirements in EARS format. Do not invent model IDs or API calls: each requirement that names one must cite the official README or model card.
3. Let Kiro build the playground; you run it and record the numbers yourself (Kiro cannot measure your laptop).
4. **Agent hook:** when `.kiro/steering/local-ai.md` is saved, check that every model entry has all template fields filled (no `<placeholder>` left).
5. Notes in `planning/kiro-notes.md`: where Kiro tried to guess an API, and how the steering rule stopped it.

## Done when

- [ ] Part 1 carry-overs done: 5 property tests passing, `fast-check` pinned, `isFallbackAdapter` updated
- [ ] The playground runs with one command and both panels work
- [ ] Two complete entries in `local-ai.md`, with measured numbers and no placeholders
- [ ] A per-tier decision and fallback written for voice and for memory
- [ ] Spec in `.kiro/specs/voice-memory-models/` and the hook committed
- [ ] Pull request into `main` by **Mon 23 Nov**

## Not part of this task

The real `circle/src/parts/voice.ts` and `memory.ts` loaders, the worker protocol and wiring into the site. Those are Part 3 (24 to 28 November), and they build directly on what you verify here.
