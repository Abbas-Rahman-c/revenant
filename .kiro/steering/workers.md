---
inclusion: fileMatch
fileMatchPattern: "circle/src/**"
---

# Workers and the summon contract

## Rules

- Models load **only** inside Web Workers, one worker per part (`circle/src/workers/<part>.worker.ts`). The main thread never imports `kokoro-js`, `@huggingface/transformers` or `@mlc-ai/web-llm`.
- The site imports only from `circle/src/index.ts`.
- Tier names are only `tiny`, `small`, `full`. Which model runs on which tier lives in one place: `circle/src/parts/registry.ts`. Every model ID there must be recorded in `local-ai.md` (a hook checks this).
- Nothing but a `CircleError` (`{ code, part, message }`) ever leaves `summon()` or a handle. Use `toCircleError` at every boundary.

## Protocol (`circle/src/workers/protocol.ts`)

- In: `{ id, type: "load", tier }`, `{ id, type: "run", op, args }`, `{ id, type: "abort" }` (cancels request `id`).
- Out: `{ id, type: "progress" | "chunk" | "result" | "error", ... }`.
- Every request gets **exactly one** `result` or `error`. The host (`host.ts`) and the connection (`conn.ts`) both enforce this; property test P1 checks it.
- Audio goes back as a transferable `ArrayBuffer`, never copied.
- A crashed worker rejects everything waiting on it (`RUN_FAILED` or `MODEL_LOAD_FAILED`) instead of hanging.

## Fallback and abort

- `summon()` starts at the sigil's tier and tries strictly lighter tiers, once each (property P2).
- Aborting during load terminates that worker and rejects with `ABORTED`. Aborting a call rejects only that call; a loaded part stays alive (property P4). `banish()` stops the worker.

## Testing

- `circle/src/test/fake-worker.ts` runs the real worker host in-process. Tests pass it through `summon(part, { createWorker })`, so they exercise the real code with no model downloads.
- IndexedDB in Node comes from `fake-indexeddb/auto`.
