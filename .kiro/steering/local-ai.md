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

> One entry per model, using the template. Every field filled with a measured or cited value; no `<placeholder>` left.

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
- Voice: af_heart
- Device: webgpu, dtype fp32 (README recommended) / wasm, dtype q8 (fallback)
- Status: VERIFIED in circle/playground/ on 2026-11-19
- Download size: ~300 MB
- License: Apache-2.0
- Browser and GPU: Chrome / Edge with WebGPU enabled, needs GPU with WebGPU support
- Cached (2nd) load time: Reload playground and press Test Voice again, copy that number here - first load 77197 ms on WASM
- Peak memory: Check Chrome Task Manager Shift+Esc while generating - ___ MB
- Offline: Yes after first download, model cached in browser
- Cross-origin headers: Cross-Origin-Embedder-Policy: require-corp, Cross-Origin-Opener-Policy: same-origin (in circle/playground/vite.config.ts)
- Snippet:
```ts
import { KokoroTTS } from "kokoro-js";
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32", device: "webgpu" });
const audio = await tts.generate("Hello, I am Revenant.", { voice: "af_heart" });
```
- Gotchas: TO FILL. WebGPU real-time factor (generate time / audio length) not recorded yet; WASM q8 measured 9434 ms for 1.98 s of audio (4.8x slower than real time).

### Memory - VERIFIED in Playground on 2026-11-19

- Package: @huggingface/transformers 4.3.2
- Model ID: Xenova/all-MiniLM-L6-v2
- Status: VERIFIED in circle/playground/
- Model loaded in: 1785 ms
- Embedding size: 384 dims
- Measured: "I love cats" vs "I love dogs" similarity = 0.757 (HIGH, correct)
- Measured: "I love cats" vs "Quantum physics is hard" similarity = 0.051 (LOW, correct)
- Pooling: mean, normalize: true
- Fallback if MiniLM fails: Xenova/bge-small-en-v1.5
- Per-tier decision: full and small = MiniLM local embeddings; tiny = keyword match, no model. Fallback = bge-small-en-v1.5, then keyword match.

### Storage and headers (to verify)

- IndexedDB through `idb` 8.0.4 stores memories and survives a reload. API calls used (`openDB`, `put`, `getAll`, `clear`) still need a link to the idb README here.
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
