# Requirements Document

## Introduction

The voice-and-memory models task verifies which real, browser-runnable models the Summoning Circle runtime should use for two of the creature's five parts: **voice** (text-to-speech) and **memory** (text embeddings for remembering the visitor). Before anyone writes the production loader code in Part 3, this spec requires a standalone playground page that loads the candidate models in a real browser, measures their download size, load time, inference speed, peak memory, offline behavior, and cross-origin isolation needs, and records the verified facts into `.kiro/steering/local-ai.md`.

The deliverable is not the production runtime. It is a measurement playground: a standalone Vite page under `circle/playground/` with two panels (Voice and Memory), plus two complete, verified entries in `local-ai.md` with a per-tier decision and fallback for each part. The production loaders, worker protocol, and site wiring come later in Part 3 and build directly on what this task verifies.

The project rule above all is: no guessed model IDs, library functions, or option names. Every model ID, library, version, and API used by the playground and recorded in `local-ai.md` must be cited to an official source (npm README or HuggingFace model card). Measurement numbers are not specified by this document; they are produced by the user running the playground on their laptop and recording what the panels display.

## Glossary

- **playground**: the standalone Vite page under `circle/playground/` (its own `index.html`, not part of `site/`) used to measure the voice and memory models before the production loaders are written.
- **voice panel**: the playground UI for text-to-speech: a Load button, a text input, a Speak button, audio playback, and a timing display.
- **memory panel**: the playground UI for text embeddings: a Load button, three fixed sentences, and their pairwise cosine similarities.
- **TTS (text-to-speech)**: the AI task that synthesizes audio from text.
- **embeddings**: numerical vectors representing the meaning of text; used by the memory part to remember the visitor.
- **cosine similarity**: a measure between -1 and 1 of how close two embedding vectors point; 1 means identical direction, 0 means unrelated.
- **dtype**: the numeric precision a model is loaded at. For kokoro-js: `"fp32"`, `"fp16"`, `"q8"`, `"q4"`, `"q4f16"`. For Transformers.js: `"fp32"`, `"fp16"`, `"q8"`, `"q4"`.
- **backend**: the execution engine a model runs on. For kokoro-js on the web: `"wasm"` or `"webgpu"`.
- **tier**: a model size class from the device sigil — `tiny`, `small`, or `full`.
- **local-ai.md entry**: a record in `.kiro/steering/local-ai.md` following the template at the top of that file: kind, library and exact version, model ID, size, tier, license, verified date and machine, a minimal working snippet, and gotchas.

## Requirements

### Requirement 1: Playground Page Runnable

**User Story:** As a developer verifying models, I want the playground to run with one command from the circle workspace, so that I can measure the voice and memory models without wiring them into the site.

#### Acceptance Criteria

1. THE circle package SHALL include a `"playground"` script in `circle/package.json` such that the playground runs with `npm run playground -w circle`.

2. THE playground SHALL be a standalone Vite page with its own `index.html` located under `circle/playground/`, separate from the `site/` app and not part of the `site/` package.

3. THE playground SHALL NOT be imported by or bundled into the `site/` app; the site app imports only from the `circle` package's public entry point, never from the playground.

### Requirement 2: Voice Panel UI

**User Story:** As a developer, I want a voice panel that loads a text-to-speech model and speaks typed text, so that I can measure download size, load time, and speaking speed.

#### Acceptance Criteria

1. THE voice panel SHALL provide a "Load" button that loads the voice model and reports real download progress values from the library, not a simulated or time-based animation.

2. THE voice panel SHALL provide a text input and a "Speak" button that synthesizes audio from the entered text and plays it.

3. WHEN the user clicks "Speak" for a 12-word sentence, THE voice panel SHALL display the time taken to synthesize that sentence, measured by the playground (not estimated).

4. THE voice panel SHALL load the model using `KokoroTTS.from_pretrained(model_id, { dtype, device })` and synthesize using `tts.generate(text, { voice })`, exactly as documented in the [kokoro-js npm README](https://www.npmjs.com/package/kokoro-js).

5. THE voice panel SHALL allow the dtype and device to be chosen from the verified options — dtype one of `"fp32"`, `"fp16"`, `"q8"`, `"q4"`, `"q4f16"`, and device one of `"wasm"` or `"webgpu"` on the web — as documented in the [kokoro-js npm README](https://www.npmjs.com/package/kokoro-js).

### Requirement 3: Memory Panel UI

**User Story:** As a developer, I want a memory panel that embeds sentences and shows their similarity, so that I can confirm the embeddings model captures semantic closeness.

#### Acceptance Criteria

1. THE memory panel SHALL provide a "Load" button that loads the embeddings model and reports real download progress values from the library, not a simulated or time-based animation.

2. THE memory panel SHALL embed the three fixed sentences — "I love the rain", "Storms make me happy", and "My laptop is broken" — and compute and display their pairwise cosine similarities.

3. THE cosine similarity between "I love the rain" and "Storms make me happy" SHALL be greater than the cosine similarity between either of those two sentences and "My laptop is broken".

4. THE memory panel SHALL load the model using the Transformers.js `pipeline('feature-extraction', model_id)` API and extract embeddings using `extractor(texts, { pooling: 'mean', normalize: true })`, following the feature-extraction usage documented on the [Xenova/bge-m3 model card](https://huggingface.co/Xenova/bge-m3) and confirmed by the [onnx-community/gte-multilingual-base README](https://huggingface.co/onnx-community/gte-multilingual-base).

### Requirement 4: Model Loading Via the Library's Real API

**User Story:** As a developer, I want the playground to call only the libraries' real, documented APIs, so that the measured numbers reflect actual library behavior and not guessed calls.

#### Acceptance Criteria

1. THE playground SHALL load the voice model with `KokoroTTS.from_pretrained` and synthesize with `tts.generate` exactly as documented in the [kokoro-js npm README](https://www.npmjs.com/package/kokoro-js).

2. THE playground SHALL load the memory model with the Transformers.js `pipeline('feature-extraction', ...)` API and run extraction with `{ pooling: 'mean', normalize: true }`, as documented on the [Xenova/bge-m3 model card](https://huggingface.co/Xenova/bge-m3).

3. THE playground MAY run model loading and inference on the main thread for measurement purposes; this deviation is permitted for the playground only, and the production Part 3 loaders SHALL run inference in a web worker per project rules.

### Requirement 5: Real Download Progress

**User Story:** As a developer, I want the Load buttons to show real progress from the library, so that the recorded download size and progress are honest.

#### Acceptance Criteria

1. THE Load buttons SHALL surface the library's real progress callback or progress values, not a simulated or time-based animation.

2. WHEN the library reports a progress value, THE playground SHALL display it; WHEN the library does not report progress, THE playground SHALL NOT display a fabricated value.

### Requirement 6: Verified local-ai.md Entries

**User Story:** As a developer building Part 3, I want two complete entries in local-ai.md with measured numbers, so that the production loaders use verified facts.

#### Acceptance Criteria

1. THE task SHALL add two entries to `.kiro/steering/local-ai.md` using the template at the top of that file — one for the voice (TTS) model and one for the memory (embeddings) model.

2. EACH entry SHALL fill every template field — kind, library and exact version, model ID, size, tier, license, verified date and machine, snippet, and gotchas — with measured or verified values, and no `<placeholder>` text SHALL remain.

3. THE voice entry SHALL record the library `kokoro-js`, the model ID `onnx-community/Kokoro-82M-v1.0-ONNX` as used by the [kokoro-js npm README](https://www.npmjs.com/package/kokoro-js), noting that the [HuggingFace model card](https://huggingface.co/onnx-community/Kokoro-82M-ONNX) lists the same Kokoro-82M ONNX build; the exact ID is whichever the library loads.

4. THE memory entry SHALL record the library `@huggingface/transformers`, the model ID `Xenova/all-MiniLM-L6-v2` per the [HuggingFace model card](https://huggingface.co/Xenova/all-MiniLM-L6-v2), license Apache-2.0 per the [original model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), and the feature-extraction API per the [bge-m3 usage example](https://huggingface.co/Xenova/bge-m3).

5. EACH entry SHALL record numbers measured by the user on their laptop — download size, first load time, second-load (cached) time, inference speed, backend actually used, peak memory, offline-after-first-load, and cross-origin isolation requirement — and SHALL NOT use estimated or invented numbers.

### Requirement 7: Per-Tier Decision and Fallback

**User Story:** As a developer, I want a per-tier decision and fallback for voice and memory, so that the production runtime knows which dtype/backend to use per tier and what to fall back to on failure.

#### Acceptance Criteria

1. THE task SHALL record, for the voice model, a decision naming which dtype and backend to use for each of the `tiny`, `small`, and `full` tiers, and the fallback model if loading fails.

2. THE task SHALL record, for the memory model, a decision naming which dtype and backend to use for each of the `tiny`, `small`, and `full` tiers, and the fallback model if loading fails.

3. THE voice decision SHALL choose dtypes only from the verified options `"fp32"`, `"fp16"`, `"q8"`, `"q4"`, `"q4f16"` and backends only from `"wasm"` or `"webgpu"`, as documented in the [kokoro-js npm README](https://www.npmjs.com/package/kokoro-js); that README notes that `dtype: "fp32"` is recommended when using `"webgpu"`.

4. THE voice fallback SHALL be the Transformers.js SpeechT5 model `Xenova/speecht5_tts` per the [HuggingFace model card](https://huggingface.co/Xenova/speecht5_tts), loaded via the Transformers.js `pipeline('text-to-speech', 'Xenova/speecht5_tts', { dtype })` API with dtype one of `"fp32"`, `"fp16"`, `"q8"`, `"q4"`, per the [@huggingface/transformers npm README](https://www.npmjs.com/package/@huggingface/transformers).

5. THE memory fallback SHALL be `Xenova/bge-small-en-v1.5` per the [HuggingFace model card](https://huggingface.co/Xenova/bge-small-en-v1.5), MIT-licensed, loaded via the same `pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5')` API as the primary, with `{ pooling: 'mean', normalize: true }`.

6. THE per-tier decisions SHALL be recorded as decisions — with the verified dtype/backend options listed — not as measured assignments, since the tier assignments are not yet measured by the user.

### Requirement 8: No-Guess Rule Enforcement

**User Story:** As a developer, I want the no-guess rule enforced, so that no invented model IDs or APIs reach the repo.

#### Acceptance Criteria

1. THE playground code SHALL NOT use any model ID, library, version, or API call that is not cited to an official source in `.kiro/steering/local-ai.md`.

2. THE local-ai.md entries SHALL NOT use any model ID, library, version, or API call that is not cited to an official source (npm README or HuggingFace model card).

3. WHEN a needed fact is not among the verified facts, THE task SHALL describe it at the capability level (for example "a text-to-speech model") without naming an unverified identifier.

### Requirement 9: Offline and Cross-Origin Isolation

**User Story:** As a developer, I want to know whether the models work offline and require cross-origin isolation, so that the production runtime and hosting are correct.

#### Acceptance Criteria

1. THE playground SHALL record — by displaying or noting — whether each model works offline after its first load.

2. THE playground SHALL record — by displaying or noting — whether each model requires COOP/COEP cross-origin isolation headers.

### Requirement 10: Exact Version Pinning

**User Story:** As a developer, I want AI libraries pinned to exact versions, so that builds are reproducible and local-ai.md stays accurate.

#### Acceptance Criteria

1. EVERY AI library added to `circle/package.json` SHALL be pinned to an exact version with no `^` or `~` prefix.

2. THE voice library SHALL be `kokoro-js` pinned to `1.2.1`, per the [npm package](https://www.npmjs.com/package/kokoro-js) and the task doc (checked on npm 20 Nov).

3. THE memory library SHALL be `@huggingface/transformers` pinned to `4.3.2`, per the [npm package](https://www.npmjs.com/package/@huggingface/transformers) and the task doc (checked on npm 20 Nov).

4. WHEN a pinned AI library version changes, THE local-ai.md entry for that library SHALL be updated in the same change.

### Requirement 11: Never Commit Model Weights

**User Story:** As a developer, I want to keep model weights out of the repo, so that the repo stays small and models download at runtime.

#### Acceptance Criteria

1. THE task SHALL NOT commit model weights to the repository.

2. THE models SHALL download at runtime and be cached (OPFS), not vendored into the repo.

## Verified sources

- kokoro-js npm package — https://www.npmjs.com/package/kokoro-js
- Kokoro-82M ONNX HuggingFace model card — https://huggingface.co/onnx-community/Kokoro-82M-ONNX
- @huggingface/transformers npm package — https://www.npmjs.com/package/@huggingface/transformers
- Xenova/speecht5_tts HuggingFace model card — https://huggingface.co/Xenova/speecht5_tts
- Xenova/all-MiniLM-L6-v2 HuggingFace model card — https://huggingface.co/Xenova/all-MiniLM-L6-v2
- sentence-transformers/all-MiniLM-L6-v2 (license) HuggingFace model card — https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
- Xenova/bge-small-en-v1.5 HuggingFace model card — https://huggingface.co/Xenova/bge-small-en-v1.5
- Xenova/bge-m3 HuggingFace model card (feature-extraction usage) — https://huggingface.co/Xenova/bge-m3
- onnx-community/gte-multilingual-base HuggingFace README (feature-extraction pattern) — https://huggingface.co/onnx-community/gte-multilingual-base
