---
inclusion: always
---

# Local AI: verified facts only

This file is the single source of truth for model IDs, library versions and API calls. It exists because coding agents invent local-AI APIs. **The rule: if it is not written here, look it up before using it.**

## Template

Every entry must have: Package, Model ID, Download size, License, Browser and GPU, Cached load, Peak memory, Offline, Cross-origin headers, Snippet, Gotchas, Measured numbers, Fallback, Per-tier decision.

## Rules for writing local-AI code

1. **Never guess** a model ID, a library function or an option name.
2. Use only the model IDs, versions and API calls listed below.
3. If you need something not listed here, verify it in the official README / model card first, then add it here with its measured numbers.
4. Do not invent fallbacks. Use only the fallbacks listed below.
5. Tier names are ONLY: tiny, small, full. Never use lite, mini, or any other name.

## Verified browser APIs

- navigator.gpu for WebGPU check. If no WebGPU, return CircleError NO_WEBGPU.
- Web Workers for model loading. Models load ONLY inside Workers, never on main thread.
- IndexedDB via idb for memory storage. Survives page reload.
- Cross-Origin Headers: COOP + COEP required for transformers.js / Kokoro.

## Voice - VERIFIED in Playground

- Package: kokoro-js 1.2.1
- Model ID: onnx-community/Kokoro-82M-v1.0-ONNX
- Voice: af_heart
- Device: webgpu, dtype fp32 (README recommended) / wasm, dtype q8 (fallback)
- Status: VERIFIED in circle/playground/ on 2026-11-19
- Download size: 300 MB
- License: Apache-2.0
- Browser and GPU: Chrome / Edge with WebGPU enabled, needs GPU with WebGPU support
- Cached (2nd) load time: 15000 ms for voice first cached load
- Peak memory: 450 MB for voice generation
- Offline: Yes after first download, model cached in browser
- Cross-origin headers: Cross-Origin-Embedder-Policy: require-corp, Cross-Origin-Opener-Policy: same-origin
- Snippet:
```ts
import { KokoroTTS } from "kokoro-js";
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32", device: "webgpu", progress_callback: (p) => console.log(p) });
const audio = await tts.generate("Hello, I am Revenant.", { voice: "af_heart" });
## Memory - VERIFIED in Playground

- Package: @huggingface/transformers 4.3.2
- Model ID: Xenova/all-MiniLM-L6-v2
- Status: VERIFIED in circle/playground/ on 2026-11-19
- Download size: 23 MB
- License: Apache-2.0
- Browser and GPU: Any modern Chrome / Edge / Firefox / Safari, no GPU needed
- Cached (2nd) load time: 290 ms
- Peak memory: 200 MB
- Offline: Yes after first download, model cached in browser
- Cross-origin headers: Same as Voice, COOP + COEP required
- Snippet:
```ts
import { pipeline } from "@huggingface/transformers";
const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { progress_callback: (p) => console.log(p) });
const out = await extractor("I love cats", { pooling: "mean", normalize: true });