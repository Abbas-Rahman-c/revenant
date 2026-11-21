# Revenant

> Stitch a mind into your browser.

**Live:** https://revenant-sigma-eight.vercel.app · A **Kiroween 2026** entry in the **Frankenstein** category.

Revenant is a creature you assemble and bring to life in a 3D lab. Pick its parts from specimen jars, throw the knife switch, and lightning wakes it. Then talk to it. Every part is a real AI model, each built on a different web technology, stitched into one body that lives entirely on your device:

| Part | What it does | Model | Runs on |
|---|---|---|---|
| Brain | thinks and answers, streamed word by word | Llama 3.2 1B or SmolLM2 360M (WebLLM) | WebGPU, in a Web Worker |
| Ears | hears you and writes down your words | Whisper tiny.en (Transformers.js) | WebAssembly or WebGPU, in a Web Worker |
| Voice | speaks, one sentence at a time | Kokoro 82M (kokoro-js) | WebGPU + Web Audio, in a Web Worker |
| Memory | remembers what you told it, even after you leave | all-MiniLM-L6-v2 embeddings | IndexedDB, in a Web Worker |
| Eyes | sees what your camera sees | EfficientDet-Lite0 (MediaPipe Tasks Vision) | GPU delegate on the main thread |

No server and no API keys. Model files download once from Hugging Face and Google's model storage, then run offline. Your camera, voice and words never leave the tab.

**Missing parts change the creature instead of breaking it.** No ears: you type. No voice: subtitles. No memory: it forgets you, and says so. No brain: it wakes with borrowed, scripted words. A device that can't run a part (no WebGPU, too little storage) gets a lighter model or a plain explanation.

## How it works

```
site/ (React + three.js)            circle/ (the runtime)                    one Web Worker per part
  jars, switch, lightning   ──►  summon(part, { onProgress, signal })  ──►  brain  · ears · voice · memory
  talk: mic, text, subtitles      device sigil picks tiny | small | full     exactly one answer per request,
  Mind: hear → recall → think       tier fallback, typed CircleErrors          abort, real byte progress
        → speak per sentence        handles: ask() · transcribe() · speak() · remember()/recall()
```

- **`circle/src/sigil/`** probes the device (WebGPU, memory, storage) and picks a tier.
- **`circle/src/summon.ts`** loads a part on that tier, falls back to strictly lighter tiers, and only ever rejects with a typed `CircleError`.
- **`circle/src/workers/`** is the message protocol: every request gets exactly one result or error; a crashed worker rejects instead of hanging.
- **`circle/src/parts/registry.ts`** is the only place model IDs live, and a hook checks each one is recorded in [`local-ai.md`](.kiro/steering/local-ai.md).
- **`site/src/mind.ts`** runs a conversation turn: recall memories, stream the brain's reply, and speak each sentence as soon as it is finished.

### Measured on a laptop with an Intel Gen12 GPU

| Part | Download | Result |
|---|---|---|
| Memory | 22.6 MB | recalls by meaning ("what weather do I like" finds "I love storms"); survives a reload |
| Ears | 41.5 MB | transcribed 3 s of speech word-for-word in 2.4 s |
| Voice | 310.5 MB | 0.56 to 0.95 s of compute per second of speech: faster than real time |
| Brain (full: Llama 3.2 1B) | 663 MB | first word in 1.25 s; with a recalled memory: "You love thunderstorms!" |
| Brain (small: SmolLM2 360M) | 194 MB | first word in 1.1 s once warm, about 6 words per second |

Details and dates in [`.kiro/steering/local-ai.md`](.kiro/steering/local-ai.md).

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. Add `?tier=small` (or `tiny`, `full`) to the address to force a tier.

The runtime has its own test bench, where every button goes through `summon()`:

```bash
npm run playground -w circle
```

Tests (unit and property-based, with fast-check):

```bash
npm test -w circle
```

## How Kiro was used

The `.kiro/` folder is how this project was built.

- **Steering**
  - `product.md`, `tech.md`, `structure.md` and `design-language.md` set the product, stack and look.
  - `local-ai.md` is a verified-facts file: no model ID, option or API may be used unless it is recorded there with its source and measured numbers.
  - `workers.md` holds the runtime's rules.
- **Specs**
  - `device-sigil`, `voice-memory-models` and `circle-runtime`, with requirements in EARS form, a design, and task lists.
  - Correctness properties in the specs became property-based tests: tier choice, exactly one answer per request, fallback only gets lighter, only typed errors escape, abort is clean, forget means forgotten.
- **Hooks**
  - Run the runtime tests when its code changes.
  - Guard `local-ai.md` against blanks and truncation, which an agent had done more than once.
  - Check that every model ID in the registry is verified.
- **MCP:** `circle-mcp/` lets the agent look up real model IDs and licenses instead of guessing.

## Credits

- **Models:**
  - Llama 3.2 1B Instruct (Meta, Llama 3.2 Community License).
  - SmolLM2 360M Instruct (Hugging Face, Apache-2.0).
  - Whisper tiny.en (OpenAI, Apache-2.0, ONNX build by onnx-community).
  - Kokoro 82M (hexgrad, Apache-2.0, ONNX build by onnx-community).
  - all-MiniLM-L6-v2 (sentence-transformers, Apache-2.0).
  - EfficientDet-Lite0 (Google MediaPipe, Apache-2.0).
- **Libraries:**
  - [WebLLM](https://github.com/mlc-ai/web-llm) (Apache-2.0).
  - [Transformers.js](https://github.com/huggingface/transformers.js) (Apache-2.0).
  - [kokoro-js](https://github.com/hexgrad/kokoro) (Apache-2.0).
  - [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) (Apache-2.0).
  - [idb](https://github.com/jakearchibald/idb) (ISC).
  - [three.js](https://threejs.org) (MIT).
  - React (MIT).
- **Body anatomy:** BodyParts3D, © The Database Center for Life Science, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Meshes reduced and combined for the web.

## License

Code: [MIT](LICENSE). Models, libraries and assets keep their own licenses (see Credits).
