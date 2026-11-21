---
inclusion: always
---

# Local AI: verified facts only

This file is the single source of truth for model IDs, library versions and API calls. It exists because coding agents invent local-AI APIs. **The rule: if it is not written here, look it up before using it.**

## Rules for writing local-AI code

1. **Never guess** a model ID, a library function or an option name. Check this file first. If it is missing, read the library's current official docs or source (or ask the `circle-mcp` server once it exists), then **add the verified entry here** before writing the code.
2. Every entry records: the library and exact version, the model ID, its approximate download size, the tier, and a minimal working snippet that has been run.
3. If a snippet stops working after an upgrade, fix this file first, then the code.
4. Prefer models with permissive licenses (Apache-2.0, MIT). Record the license.
5. Do not invent fallbacks. Use only the fallbacks recorded in an entry below.
6. Tier names are ONLY: tiny, small, full. Never use lite, mini, or any other name.
7. Models load ONLY inside Web Workers, never on the main thread (see `workers.md`).

## Verified entries

> One entry per model, using the template. Every field filled with a measured or cited value; no blanks left (the check script in `scripts/check-local-ai.mjs` enforces this).

### Template

```
Kind:       speech-to-text | llm | tts | vision | embeddings | depth
Library:    <package>@<exact version>
Model ID:   <exact id>
Size:       ~<MB> download
Tier:       tiny | small | full
License:    <license>
Verified:   <date>, <browser + GPU it was run on>
Snippet:
  <the smallest code that loads the model and runs one inference>
Gotchas:
  <anything surprising: required flags, memory spikes, slow first run>
```

### Voice - VERIFIED in Playground

- Package: kokoro-js 1.2.1
- Model ID: onnx-community/Kokoro-82M-v1.0-ONNX
- Voice: af_heart (measured); the runtime uses am_michael, a male voice listed in kokoro-js 1.2.1's voice table (grade C+)
- Device: webgpu, dtype fp32 (README recommended) / wasm, dtype q8 (fallback)
- Status: VERIFIED in circle/playground/ on 2026-11-19
- Download size: 300 MB
- License: Apache-2.0
- Browser and GPU: Chrome / Edge with WebGPU enabled, needs GPU with WebGPU support
- Cached (2nd) load time: 15000 ms for voice first cached load
- Peak memory: 450 MB for voice generation
- Offline: Yes after first download, model cached in browser
- Cross-origin headers: the playground sends COEP require-corp + COOP same-origin; whether Kokoro needs them is untested (see Storage and headers).
- Snippet:
```ts
import { KokoroTTS } from "kokoro-js";
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32", device: "webgpu", progress_callback: (p) => console.log(p) });
const audio = await tts.generate("Hello, I am Revenant.", { voice: "af_heart" });
```
- Gotchas: WASM q8 measured 9434 ms for 1.98 s of audio (4.8x slower than real time). The WebGPU real-time factor has not been recorded yet. The worker falls back from WebGPU fp32 to WASM q8 if WebGPU fails.
- Fallback if Kokoro fails: Xenova/speecht5_tts, then the browser's built-in voice.
- Per-tier decision: full = Kokoro on WebGPU; small and tiny = browser voice (Kokoro is too slow on WASM).

### Memory - VERIFIED in Playground

- Package: @huggingface/transformers 4.3.2
- Model ID: Xenova/all-MiniLM-L6-v2
- Status: VERIFIED in circle/playground/ on 2026-11-19
- Download size: 22.6 MB (measured from byte progress, 2026-11-21)
- License: Apache-2.0
- Browser and GPU: Any modern Chrome / Edge / Firefox / Safari, no GPU needed
- Cached (2nd) load time: 290 ms
- Peak memory: 200 MB
- Offline: Yes after first download, model cached in browser
- Cross-origin headers: same as Voice; untested without them.
- Snippet:
```ts
import { pipeline } from "@huggingface/transformers";
const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { progress_callback: (p) => console.log(p) });
const out = await extractor("I love cats", { pooling: "mean", normalize: true });
```
- Measured: "I love cats" vs "I love dogs" similarity = 0.757; vs "Quantum physics is hard" = 0.051.
- Fallback if MiniLM fails: Xenova/bge-small-en-v1.5, then keyword match.
- Per-tier decision: full and small = MiniLM; tiny = keyword match, no model.

### Brain - VERIFIED against the package

- Package: @mlc-ai/web-llm 0.2.89 (Apache-2.0)
- Model IDs (all in `prebuiltAppConfig.model_list` of 0.2.89, checked 2026-11-21):
  - full: Llama-3.2-1B-Instruct-q4f16_1-MLC (VRAM 879 MB); without the GPU feature `shader-f16`: Llama-3.2-1B-Instruct-q4f32_1-MLC (1129 MB)
  - small: SmolLM2-360M-Instruct-q4f16_1-MLC (376 MB, needs `shader-f16`); without it: SmolLM2-360M-Instruct-q4f32_1-MLC (580 MB)
  - tiny: none (WebLLM needs WebGPU); the site falls back to scripted lines
- License: Llama 3.2 Community License (Llama); Apache-2.0 (SmolLM2)
- API used: `CreateMLCEngine(modelId, { initProgressCallback })` (callback gets `{ progress: 0..1, text }`, no byte counts), `engine.chat.completions.create({ messages, stream: true, max_tokens, temperature })` (async iterable of `{ choices: [{ delta: { content } }] }`), `engine.interruptGenerate()`, `hasModelInCache(modelId)`
- Snippet:
```ts
import { CreateMLCEngine } from "@mlc-ai/web-llm";
const engine = await CreateMLCEngine("SmolLM2-360M-Instruct-q4f16_1-MLC", { initProgressCallback: (r) => console.log(r.progress, r.text) });
for await (const c of await engine.chat.completions.create({ messages: [{ role: "user", content: "Hi" }], stream: true })) console.log(c.choices[0]?.delta?.content);
```
- Gotchas: runs inside our own worker (WebGPU is available in workers). Choose the q4f32 build when `adapter.features.has("shader-f16")` is false. Progress is a fraction only.

### Ears - VERIFIED in the test bench

- Package: @huggingface/transformers 4.3.2
- Model ID: onnx-community/whisper-tiny.en (Apache-2.0, model card checked 2026-11-21)
- Device and dtype: full = webgpu fp32; small and tiny = wasm q8
- Download size: 41.5 MB (wasm q8, measured from the library's byte progress, 2026-11-21)
- First load: 56 s on the built-in browser pane (Intel Gen12 laptop GPU, slow network), including download and a one-second warm-up
- Input: 16 kHz mono Float32Array
- API used: `pipeline("automatic-speech-recognition", model, { device, dtype, progress_callback })`, then `await asr(samples)` returns `{ text }`
- Snippet:
```ts
import { pipeline } from "@huggingface/transformers";
const asr = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny.en", { device: "wasm", dtype: "q8" });
const { text } = await asr(new Float32Array(16000));
```
- Gotchas: Whisper returns things like "[BLANK_AUDIO]" for silence; the ears part turns those into an empty string.

### Progress events (Transformers.js and Kokoro)

- Verified in `@huggingface/transformers` 4.3.2 `types/utils/core.d.ts`: the `progress_callback` receives `{ status: "initiate" | "download" | "done", file }`, `{ status: "progress", file, loaded, total, progress }`, `{ status: "progress_total", loaded, total }` and `{ status: "ready" }`. Kokoro 1.2.1 passes the same callback to its own Transformers.js 3.8.1.
- `circle/src/parts/progress.ts` adds up `loaded` and `total` per file.

### Storage and headers (to verify)

- IndexedDB through `idb` 8.0.4 (ISC) stores memories and survives a reload (verified 2026-11-21: remembered, reloaded, recalled). API used: `openDB(name, version, { upgrade })`, `db.add`, `db.getAll`, `db.delete`, `db.clear`. Tests use `fake-indexeddb` 6.2.8 (Apache-2.0).
- Cross-origin isolation: the playground sends COOP `same-origin` + COEP `require-corp`. Whether Kokoro or Transformers.js actually *need* them is not yet measured; test once with the headers removed and record the result.

## Verified browser APIs (device probe)

> Browser capabilities read by `circle/src/sigil/probe.ts`, not AI model libraries. Recorded here per the "never guess an API" rule so the probe and future code use verified signatures. Verified against MDN / the WebGPU spec, Nov 2026.

### `navigator.gpu.requestAdapter()`
- Returns `Promise<GPUAdapter | null>`; resolves to `null` when no adapter is available ([MDN: GPU.requestAdapter](https://developer.mozilla.org/en-US/docs/Web/API/GPU/requestAdapter)).
- Requires a secure context (HTTPS); also available in Web Workers. WebGPU is not yet Baseline across all major browsers.
- From the adapter, read `adapter.info` (`GPUAdapterInfo`) and `adapter.limits` (`GPUSupportedLimits`).

### `isFallbackAdapter` (software adapter detection)
- **Current location:** `adapter.info.isFallbackAdapter` on `GPUAdapterInfo` — a boolean ([MDN: GPUAdapterInfo.isFallbackAdapter](https://developer.mozilla.org/en-US/docs/Web/API/GPUAdapterInfo/isFallbackAdapter)).
- **Deprecated/removed:** `GPUAdapter.isFallbackAdapter` — MDN marks it removed from the web platform; use `GPUAdapterInfo.isFallbackAdapter` instead ([MDN: GPUAdapter](https://developer.mozilla.org/en-US/docs/Web/API/GPUAdapter)).
- A fallback adapter is a software renderer with significant performance caveats. The probe counts a fallback adapter as no WebGPU.
- **Our code:** `probe.ts` reads `adapter.info?.isFallbackAdapter` first and falls back to the old `adapter.isFallbackAdapter` for older browsers (Task 02 carry-over, done).

### `adapter.limits.maxBufferSize`
- `adapter.limits` is a `GPUSupportedLimits` object; `maxBufferSize` is in **bytes** ([MDN: GPUSupportedLimits](https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedLimits)).
- Default value is `268435456` bytes (256 MB). Browsers report tier values, not exact hardware limits, to reduce fingerprinting.
- Convert to MB: divide bytes by `1024 * 1024` (1,048,576). The probe does `Number(maxBufferSize) / (1024 * 1024)`; `Number()` coerces a `bigint` defensively (the spec TS types declare `number`).

### `navigator.deviceMemory`
- Returns approximate device RAM in gigabytes ([MDN: Device Memory API](https://developer.mozilla.org/en-US/docs/Web/API/Device_Memory_API), [MDN: Navigator.deviceMemory](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory)).
- Approximated by rounding actual memory to the nearest power of two and clamping within lower and upper bounds; the bounds may change over time (commonly reported as roughly 1–8 GB).
- **Non-standard, limited availability:** exposed by Chrome; Safari and Firefox omit it, so it is `undefined` there. This is why `chooseTier`'s `small` tier tolerates unknown memory (reported as `UNKNOWN_MEMORY`).

### `navigator.hardwareConcurrency`
- Read-only; returns the number of logical processors available to run threads ([MDN: hardwareConcurrency](https://developer.mozilla.org/en-US/docs/Web/API/NavigatorConcurrentHardware/hardwareConcurrency)).
- Widely supported across Chrome, Edge, Firefox, and Safari. The value may be reduced by the browser to limit fingerprinting or worker counts. Available in Web Workers.

### `navigator.storage.estimate()`
- `navigator.storage.estimate()` returns `Promise<{ quota, usage }>` in bytes ([MDN: StorageManager.estimate()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate)).
- `quota` is the space available to the origin; `usage` is how much the origin already uses. Both are estimates, not exact figures.
- Free storage = `quota - usage` (bytes). Convert to MB by dividing by `1024 * 1024` (1,048,576). The probe only sets `freeStorageMB` when both `quota` and `usage` are numbers.
