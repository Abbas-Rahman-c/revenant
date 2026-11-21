# Design Document

## Overview

```
site ──► summon(part, opts) ──► Conn ──postMessage──► <part>.worker.ts ──► serve(impl) ──► library
          │  tiers from sigil      │  pending map by id        host.ts: inflight map,
          │  registry per tier     │  crash → reject all       exactly one answer per id
          ▼                        ▼
       typed handle  ◄─────── result / chunk / progress / error
```

## Files

| File | Role |
|---|---|
| `src/types.ts` | Public types: parts, tiers, `Progress`, `CircleError`, the four handles. |
| `src/errors.ts` | `circleError`, `isCircleError`, `toCircleError(x, part, during)`. |
| `src/workers/protocol.ts` | Message types and `WorkerLike`, the slice of `Worker` the runtime needs (lets tests pass a fake). |
| `src/workers/host.ts` | Worker side. `serve(impl, scope)`: loads once (a failed load can be retried), runs ops, keeps an `AbortController` per request, answers each id once. |
| `src/workers/conn.ts` | Main side. `request()` returns a promise settled once: result, error, abort, or crash. `terminate()` rejects what is waiting with `ABORTED`. |
| `src/parts/registry.ts` | Model per part and tier. The only place model IDs live. |
| `src/parts/*.impl.ts` | One implementation per part: `load(tier, ctx)` and named ops. |
| `src/parts/progress.ts` | Sums Transformers.js per-file byte events into one `Progress`. |
| `src/parts/text.ts` | `splitSentences`, `keywordScore`. |
| `src/handles.ts` | Typed wrappers over `Conn` for each part, including streaming. |
| `src/summon.ts` | Tier choice, fallback loop, worker creation, handle building. |

## Key decisions

- **One worker per part**, so the brain's 1 GB of GPU memory and the voice's model never share a thread, and one crash takes out one part.
- **Load is idempotent in the host**: a second `load` waits for the first; a failed one clears so a retry can run.
- **Abort is answered by the host at once** (an `ABORTED` error for that id), and the op sees `signal.aborted`. Late results for an aborted id are dropped on both sides.
- **The brain picks its build from the GPU**: `shader-f16` present → q4f16 model, else q4f32.
- **fromCache** is true when every file's first progress event already reports `loaded === total`.
- **Memory schema v2** keys rows with `autoIncrement` (v1 keyed by time, so two memories in one millisecond overwrote each other); the upgrade drops the v1 store.

## Correctness properties (tested in `src/summon.test.ts` through `FakeWorker`)

| # | Property | How the test drives it |
|---|---|---|
| P1 | Exactly one answer per request | random batches of calls with random delays and failures; counts settlements per call |
| P2 | Fallback only gets lighter | random failing tier sets and start tiers; records tiers attempted |
| P3 | Only `CircleError`s escape | the part throws `fc.anything()` on every tier |
| P4 | Abort is clean | aborts at random times against random load times; then checks the loaded part still works and per-call abort |
| P5 | Forget means forgotten | random texts, both the embedding tier (deterministic test embedder) and the keyword tier, with `fake-indexeddb` |

## Error handling

`toCircleError` is applied in the host (per request, knowing load vs run) and again in `summon` (for anything thrown on the main thread, such as a `Worker` constructor failure).
