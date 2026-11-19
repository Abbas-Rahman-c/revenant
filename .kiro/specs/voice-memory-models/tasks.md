# Implementation Plan

## Overview

This is the **tasks phase** of the `voice-memory-models` spec. The requirements (`requirements.md`) and design (`design.md`) in `.kiro/specs/voice-memory-models/` are finalized; every model ID, library, version, and API named there is already verified and cited to an official source (npm README or HuggingFace model card). This plan introduces **no new identifiers** — every task that names a model, library, or API references it as already-verified in the spec, per the no-guess rule (Requirement 8).

The deliverable is a **measurement playground** — a standalone Vite page under `circle/playground/` with Voice and Memory panels — plus two complete entries in `.kiro/steering/local-ai.md` and a per-tier decision + fallback for each part. The playground may load and infer on the main thread for measurement only (Requirement 4.3); the production Part 3 loaders will move all inference into a web worker. Model weights are never committed — they download at runtime and cache in OPFS (Requirement 11).

The measurements themselves (download size, peak memory, offline behavior, cross-origin isolation) are produced by the **user** running the playground on their laptop in Chrome and reading DevTools. Kiro cannot measure the user's hardware; the playground displays only what it can measure in-page (progress, load/synthesis/embedding timings, backend used), and the user records the rest. The "Done when" checklist in `planning/tasks/task-02-voice-memory-models.md` is the source of truth for these tasks.

## Tasks

- [ ] 1. Part 1 carry-overs (device-sigil, ~1 hour, on `circle/src/sigil/`)
  - [ ] 1.1 Verify the 5 property-based tests exist in `tier.test.ts`; add any that are missing. Use the already-installed `fast-check`. The five properties (per the device-sigil test-coverage table): more-never-hurts (P1), no-WebGPU-means-no-GPU-tiers (P2), fits-the-device (P3), deterministic (P4), honest-reasons (P5). These may already exist from the device-sigil work — verify and add only what is missing.
    - _Requirements: device-sigil P1–P5 (Req 3.1, 1.5, 1.6, 3.2, 2.1/2.2)_
  - [ ] 1.2 Confirm `fast-check` is pinned to an exact version in `circle/package.json` (no `^` or `~`); fix if a prefix is present. The task doc flagged `^3.20.0` — verify the current state and correct it. (The file currently reads `3.20.0`; treat as verify-and-fix.)
    - _Requirements: tech rule (exact version pinning)_
  - [ ] 1.3 Switch the fallback-adapter check in `circle/src/sigil/probe.ts` from the deprecated `adapter.isFallbackAdapter` to `adapter.info?.isFallbackAdapter`, keeping a fallback to the old property for older browsers. This was flagged in `.kiro/steering/local-ai.md` under the `isFallbackAdapter` note.
    - _Requirements: device-sigil Req 4.2; local-ai.md `isFallbackAdapter` gotcha_

- [ ] 2. Build the playground under `circle/playground/`
  - [ ] 2.1 Create the standalone Vite playground files: `index.html`, `vite.config.ts`, `src/main.ts` (creates and wires the two panels into the DOM), `src/voice-panel.ts`, and `src/memory-panel.ts` — per the design's file layout. The playground is separate from `site/` and must not be imported or bundled by it.
    - _Requirements: 1.2, 1.3_
  - [ ] 2.2 Confirm the `"playground"` script in `circle/package.json` runs the playground with `npm run playground -w circle` (the config-based Vite command). Verify it is present; add if missing.
    - _Requirements: 1.1_
  - [ ] 2.3 Confirm the AI libraries are pinned to exact versions in `circle/package.json` (no `^`/`~`): `kokoro-js` to `1.2.1` and `@huggingface/transformers` to `4.3.2`. Verify; fix prefixes if present. When a pinned version later changes, update the matching `local-ai.md` entry in the same change.
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [ ] 2.4 Implement the Voice panel in `voice-panel.ts`: dtype and device selectors offering only the verified options (dtype `fp32`/`fp16`/`q8`/`q4`/`q4f16`; device `wasm`/`webgpu`), a Load button that calls `KokoroTTS.from_pretrained(model_id, { dtype, device })` and surfaces the library's real download progress (no fabricated values when none is reported), a text input and a Speak button that calls `tts.generate(text, { voice })` (voice from `tts.list_voices()`, example `af_heart`), plays the returned audio, and displays the synthesis time measured around `generate` for a 12-word sentence. All APIs are already verified in the spec; record the exact model ID and progress/audio shape during implementation into the entry's gotchas. Note: `device: "webgpu"` recommends `dtype: "fp32"`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2_
  - [ ] 2.5 Implement the Memory panel in `memory-panel.ts`: a Load button that calls `pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')` and surfaces real download progress, then embeds the three fixed sentences ("I love the rain", "Storms make me happy", "My laptop is broken") with `extractor(texts, { pooling: 'mean', normalize: true })`, computes and displays the three pairwise cosine similarities as dot products of the unit vectors (`normalize: true` ⇒ cosine = dot product), and visibly asserts the semantic-closeness invariant: `sim("I love the rain", "Storms make me happy")` > `sim(either of those, "My laptop is broken")`. APIs already verified in the spec.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.1, 5.2_
  - [ ] 2.6 Instrument the panels to display in-page the measures they can read: real download progress (or nothing if the library reports none), first and cached load timings, synthesis/embedding timings, and the backend actually used. Leave peak memory, download-size MB, offline-after-first-load, and cross-origin-isolation for the user to record from DevTools. The playground may infer on the main thread for measurement (Requirement 4.3); record a "main-thread-for-measurement-only" gotcha in each entry so it is not copied into the production worker code.
    - _Requirements: 2.3, 4.3, 5.1, 5.2_
  - [ ] 2.7 Verify the playground runs with one command and both panels work; run `npm run typecheck -w circle` and confirm it passes under strict mode.
    - _Requirements: 1.1; tech rule (strict TS, all public functions tested)_

- [ ] 3. Measure the models (USER — Kiro cannot measure your laptop)
  - [ ] 3.1 **USER:** run the playground in Chrome and record the measured numbers for each model into the two `local-ai.md` entries — download size (Network tab, first load), first load time (click to ready), second/cached load time, speed (voice: time to synthesize a 12-word sentence; memory: ms per sentence), backend actually used, peak memory (Performance/Memory tab), works offline after first load, and cross-origin-isolation requirement. Also try each model with WebGPU turned off (the library's WASM option or `chrome://flags`) to exercise the fallback path. Record only measured numbers — no estimates or invented values.
    - _Requirements: 6.5, 9.1, 9.2_

- [ ] 4. Write the `local-ai.md` entries and per-tier decisions
  - [ ] 4.1 Write the voice (TTS) entry in `.kiro/steering/local-ai.md` using the template at the top of that file, filling every field — kind `tts`, library `kokoro-js@1.2.1`, model ID the exact ID the library loads (`onnx-community/Kokoro-82M-v1.0-ONNX` or `onnx-community/Kokoro-82M-ONNX` per the spec), size (measured), tier `full`, license Apache-2.0, verified date + browser/GPU, a minimal working snippet from the spec, and measured gotchas (progress option name, returned audio shape, WebGPU-recommends-fp32, memory spikes, slow first run, offline/COOP-COEP, main-thread-for-measurement-only) — with measured/verified values and no `<placeholder>` remaining.
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 8.2_
  - [ ] 4.2 Write the memory (embeddings) entry using the template, every field filled — kind `embeddings`, library `@huggingface/transformers@4.3.2`, model ID `Xenova/all-MiniLM-L6-v2`, size (measured), tier `full`, license Apache-2.0 (per the original model card), the feature-extraction snippet per the bge-m3 usage example in the spec, and measured gotchas — no `<placeholder>`.
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 8.2_
  - [ ] 4.3 Append a per-tier decision + fallback for voice: for each of `tiny`/`small`/`full`, name a dtype (chosen only from the verified kokoro-js options `fp32`/`fp16`/`q8`/`q4`/`q4f16`) and a backend (`wasm`/`webgpu`); the fallback is `Xenova/speecht5_tts` via Transformers.js `pipeline('text-to-speech', 'Xenova/speecht5_tts', { dtype })` (dtype `fp32`/`fp16`/`q8`/`q4`). This is a decision with the verified options listed, not a measured assignment.
    - _Requirements: 7.1, 7.3, 7.4, 7.6_
  - [ ] 4.4 Append a per-tier decision + fallback for memory: for each of `tiny`/`small`/`full`, name a dtype (from the verified Transformers.js options `fp32`/`fp16`/`q8`/`q4`) and the backend measured at runtime; the fallback is `Xenova/bge-small-en-v1.5` (MIT) via the same `pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5')` API with `{ pooling: 'mean', normalize: true }`. Decision, not measured assignment.
    - _Requirements: 7.2, 7.5, 7.6_

- [ ] 5. Hook, notes, and pull request
  - [ ] 5.1 Add an agent hook in `.kiro/hooks/` that, on save of `.kiro/steering/local-ai.md` (trigger `PostFileSave`, matcher for `local-ai.md`), checks that every model entry has all template fields filled — i.e. no `<placeholder>` remains. Use a small shell/grep check that fails (non-zero exit) when a placeholder is found, so an incomplete entry cannot slip into the repo.
    - _Requirements: 6.2_
  - [ ] 5.2 Add notes to `planning/kiro-notes.md` recording where Kiro tried to guess an API and how the steering no-guess rule stopped it (per the task doc's step 5). Process note only — not part of the runtime.
    - _Requirements: 8.1, 8.2, 8.3 (no-guess rule)_
  - [ ] 5.3 Commit on branch `feature/voice-memory-models`: the spec (`.kiro/specs/voice-memory-models/`), the playground under `circle/playground/`, the `local-ai.md` entries + decisions, the hook in `.kiro/hooks/`, the carry-over changes (1.x), and the `package.json` pins. Never commit model weights.
    - _Requirements: 11.1, 11.2_
  - [ ] 5.4 Open a pull request into `main` by Mon 23 Nov, with a short description and the test/typecheck output.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "2.1", "2.2", "2.3", "5.1"] },
    { "id": 1, "tasks": ["2.4", "2.5"] },
    { "id": 2, "tasks": ["2.6"] },
    { "id": 3, "tasks": ["2.7"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["4.1", "4.2", "4.3", "4.4"] },
    { "id": 6, "tasks": ["5.2", "5.3"] },
    { "id": 7, "tasks": ["5.4"] }
  ]
}
```

## Notes

- All model IDs, libraries, versions, and APIs named above are already verified and cited in `requirements.md` and `design.md`; this plan introduces no new identifiers (no-guess rule, Requirement 8).
- The playground may run inference on the main thread for measurement only (Requirement 4.3). Production Part 3 loaders will move all inference into a web worker; record this as a gotcha in each `local-ai.md` entry so it is not copied forward.
- Model weights are never committed (Requirement 11). Models download at runtime and cache in OPFS; no weights are vendored into the repo.
- Tasks 2.2 and 2.3 may already be satisfied — the `playground` script and exact-pinned AI libraries (`kokoro-js@1.2.1`, `@huggingface/transformers@4.3.2`) appear present in `circle/package.json`; treat them as verify-and-fix.
- The user, not Kiro, produces the measurement numbers (task 3.1). Kiro builds the playground and writes the entries' verified/template fields; the user fills in the measured values and tests offline + cross-origin isolation.
- Correctness properties (real-not-fabricated progress, measured-not-estimated timings, semantic closeness, cosine-of-unit-vectors = dot product, no-guess, complete entries) are observable invariants the user checks by running the panels and reading the entries — there is no pure decision function here to property-test, per the design.
