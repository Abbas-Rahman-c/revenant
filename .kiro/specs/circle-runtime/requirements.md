# Requirements Document

## Introduction

The circle runtime loads the creature's parts (brain, ears, voice, memory) as real AI models in the visitor's browser, and gives the site one typed function to do it: `summon(part, options)`. Each part runs in its own Web Worker. The runtime picks the largest model the device can run (from the device sigil), falls back to lighter models when a load fails, reports real progress, can be aborted, and only ever fails with a typed `CircleError`.

This spec replaces the first-pass runtime from Tasks 03 and 04, where memory was a stub, progress never fired, abort could kill a loaded part, and the tests did not call `summon`.

## Glossary

- **part**: one of `brain` (chat model), `ears` (speech to text), `voice` (text to speech), `memory` (embeddings and storage).
- **tier**: `tiny`, `small` or `full`, from the device sigil. The registry maps part and tier to a model.
- **handle**: the typed object `summon` resolves with (`BrainHandle`, `EarsHandle`, `VoiceHandle`, `MemoryHandle`).
- **CircleError**: `{ code, part, message }`, with `code` one of `NO_WEBGPU`, `OUT_OF_MEMORY`, `LOW_STORAGE`, `DOWNLOAD_FAILED`, `MODEL_LOAD_FAILED`, `RUN_FAILED`, `ABORTED`.
- **request**: one message from the main thread to a worker (`load` or `run`), identified by an id.

## Requirements

### Requirement 1: Typed handles

**User Story:** As the site, I want `summon` to return a handle typed for the part I asked for, so that I can call its methods without casts.

1. WHEN `summon("brain")` resolves, THE runtime SHALL return a `BrainHandle` with `ask(messages)` streaming the reply as text pieces.
2. WHEN `summon("ears")` resolves, THE runtime SHALL return an `EarsHandle` with `transcribe(samples)` taking 16 kHz mono audio.
3. WHEN `summon("voice")` resolves, THE runtime SHALL return a `VoiceHandle` with `speak(text)` and `speakStream(text)`, the second yielding one sentence of audio at a time.
4. WHEN `summon("memory")` resolves, THE runtime SHALL return a `MemoryHandle` with `remember`, `recall(query, k)` and `forget(id?)`.
5. THE public types SHALL contain no `any`.

### Requirement 2: Exactly one answer

1. FOR every request, THE runtime SHALL settle the caller's promise exactly once, with the result or error for that request's own id. **Property P1.**
2. IF a worker crashes, THEN THE runtime SHALL reject every request waiting on it, and every later request, with a `CircleError` instead of hanging.

### Requirement 3: Tier fallback

1. THE runtime SHALL start at the tier given in the options, or the device sigil's tier when the option is `auto` (a sigil tier of `none` starts at `tiny`).
2. IF loading a part fails on a tier, THEN THE runtime SHALL stop that worker and try the next strictly lighter tier, at most once per tier. **Property P2.**
3. IF the registry has no model for a part on a tier, THEN THE runtime SHALL skip that tier and, when no tier is left, reject with the registry's reason (for example `NO_WEBGPU` for the voice on `small`).

### Requirement 4: Typed errors only

1. WHATEVER a part implementation throws, THE caller SHALL receive a `CircleError` with a valid code and the right part. **Property P3.**
2. THE runtime SHALL map known failures to specific codes: network failures while loading to `DOWNLOAD_FAILED`, memory exhaustion to `OUT_OF_MEMORY`, storage quota to `LOW_STORAGE`, aborts to `ABORTED`.

### Requirement 5: Abort

1. WHEN the summon signal aborts before the part has loaded, THE runtime SHALL terminate the worker and reject with `ABORTED`.
2. WHEN the summon signal aborts after the part has loaded, THE runtime SHALL leave the loaded part working. **Property P4.**
3. WHEN a call's own signal aborts, THE runtime SHALL reject only that call with `ABORTED`, and tell the worker to stop it (the brain calls `interruptGenerate`).
4. WHEN `banish()` is called, THE runtime SHALL stop the worker and reject calls in flight with `ABORTED`.

### Requirement 6: Real progress

1. WHILE a part loads, THE runtime SHALL report `Progress` with the part, a stage, and a fraction from 0 to 1.
2. WHERE the library reports bytes (Transformers.js, Kokoro), THE runtime SHALL report the summed `loadedBytes` and `totalBytes` of all files, never an estimate.
3. THE runtime SHALL report `fromCache: true` when no file had to be downloaded.

### Requirement 7: Memory

1. WHEN `remember(text)` is called, THE memory part SHALL store the text, the time and (above the tiny tier) its embedding in IndexedDB, so that it survives a reload.
2. WHEN `recall(query, k)` is called, THE memory part SHALL return at most `k` memories, most similar first, by cosine similarity of embeddings, or by shared words on the tiny tier.
3. AFTER `forget()`, `recall` SHALL return an empty list; after `forget(id)`, that memory SHALL no longer be recalled. **Property P5.**

### Requirement 8: Verified models only

1. EVERY model ID in `circle/src/parts/registry.ts` SHALL be recorded in `.kiro/steering/local-ai.md` with its source. A hook (`registry-guard`) checks this on save.
2. THE voice SHALL run only where Kokoro speaks faster than real time; on WebAssembly it measured about 5 times slower, so the voice is `full`-tier only and the site falls back to the browser's speech voice.
