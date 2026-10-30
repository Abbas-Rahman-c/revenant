---
inclusion: always
---

# Tech stack and rules

## Stack

- **Language:** TypeScript (strict mode) everywhere. No plain JavaScript source files.
- **Package manager:** npm workspaces (monorepo: `site`, `circle`, `circle-mcp`, `apps/*`, `benchmark`).
- **Apps:** Vite + React. Static output only, deployable to free static hosting. No backend server.
- **Local AI libraries** (pick per model type, record the choice in `local-ai.md`):
  - Transformers.js (`@huggingface/transformers`) for speech-to-text, embeddings, vision and small models
  - WebLLM (`@mlc-ai/web-llm`) for chat language models on WebGPU
  - MediaPipe Tasks for Web for face and object tracking
- **Testing:** Vitest for unit tests, fast-check for property-based tests, Playwright for browser smoke tests (Chromium with WebGPU flags).
- **MCP server:** TypeScript with the official MCP SDK, stdio transport.

## Rules

- **Pin exact versions** of every AI library in `package.json` (no `^` or `~`). When a version changes, update `local-ai.md` in the same change.
- **All inference runs in a web worker.** The main thread only handles UI. Never block it with model loading or inference.
- **Never commit model weights.** Models download at runtime and are cached in OPFS.
- **Every public `circle` function has a TSDoc comment and a test.**
- **Errors are typed.** Use a small set of `CircleError` codes (for example `NO_WEBGPU`, `OUT_OF_MEMORY`, `MODEL_LOAD_FAILED`, `ABORTED`) instead of throwing strings.
- **Apps import only from the `circle` package's public entry point**, never from its internal files. This proves the skeleton is reusable.
- **Accessibility:** keyboard reachable controls, captions for anything spoken, and `prefers-reduced-motion` respected.
- Keep dependencies few. Ask before adding a large dependency.
