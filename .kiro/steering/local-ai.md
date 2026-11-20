---
inclusion: always
---

# Local AI: verified facts only

This file is the single source of truth for model IDs, library versions and API calls. It exists because coding agents invent local-AI APIs. **The rule: if it is not written here, look it up before using it.**

## Rules for writing local-AI code

1. **Never guess** a model ID, a library function or an option name.
2. Use only the model IDs, versions and API calls listed below.
3. If you need something not listed here, verify it in the official README / model card first, then add it here with its measured numbers.
4. Do not invent fallbacks. Use only the fallbacks listed below.
5. Tier names are ONLY: tiny, small, full. Never use lite, mini, or any other name.

## Browser APIs - Part 1 (from Task 01)

- WebGPU: Use `navigator.gpu` to check if GPU is available. If no WebGPU, return CircleError NO_WEBGPU.
- Web Workers: Models load ONLY inside Workers, never on main thread.
- IndexedDB: Use `idb` library to store memories, survives reload.
- Cross-Origin Headers: Must have COOP + COEP headers or transformers.js / Kokoro will not load.

## Voice - VERIFIED in Playground

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