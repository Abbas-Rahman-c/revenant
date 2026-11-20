# Task 03: Build the voice and memory parts

**Owner:** Sunaina · **Dates:** Fri 20 to Wed 25 November · **Area:** `circle/src/parts/`, `circle/src/workers/`, `.kiro/` · **Build it in:** Kiro

---

## Task 02 review

Merged as PR #2. What is good:

- **All 5 property tests** are in and pass, `fast-check` and the other dev tools are pinned exactly, and `probe.ts` reads `adapter.info?.isFallbackAdapter` with the old property as a fallback. All three carry-overs are done.
- **The spec is excellent.** `requirements.md` cites the README or model card for every model ID and API, and `design.md` and `tasks.md` are thorough. This is exactly the Kiro usage judges want to see.
- **Both models really ran in your browser:** Kokoro spoke, and MiniLM put "cats" near "dogs" (0.757) and far from "quantum physics" (0.051).

What needs fixing (about 2 hours, do this first):

1. **Kokoro on WebAssembly is too slow to talk.** It took 9.4 s to make 2.0 s of speech, almost 5 times slower than real time. A visitor would wait 30 s for one sentence. **Measure it on WebGPU** (`device: "webgpu"`, `dtype: "fp32"`, as the README recommends). That number decides whether Kokoro is usable at all.
2. **The entries are missing template fields:** download size, license, the browser and GPU used, the snippet, gotchas, cached (second) load time, peak memory, whether it works offline, and whether it needs the cross-origin headers. Fill them in the template format.
3. **Use our tier names.** The decisions say Full, Lite and Fallback; the sigil returns `tiny`, `small` and `full`. Write one line per tier.
4. **Missing from the commit:** the `local-ai.md` hook (no file in `.kiro/hooks/`), Task 02 notes in `planning/kiro-notes.md`, and the ticks in `.kiro/specs/voice-memory-models/tasks.md` (all still `[ ]`).
5. **The Task 02 commit deleted half of `local-ai.md`**: the template, the full rules and your own Part 1 browser-API section. I restored them (your two entries are kept). If Kiro rewrites a steering file, check the diff before committing.

**Also:** your merge broke the Vercel deploy. `kokoro-js` installs `onnxruntime-node`, which tries to download a CUDA build and gets a 404. I fixed it (`vercel.json` now runs `npm ci --onnxruntime-node-install-cuda=skip`). If `npm ci` hangs on your laptop, use the same flag.

---

## What and why

Task 02 proved the models work. Now we turn them into real **parts** the creature can use: code in `circle/src/` that the site will call, running in a **Web Worker** so the 3D lab never freezes while a model thinks.

- **Voice** makes the creature speak its first words and its replies.
- **Memory** remembers what the visitor says and recalls it later, even after they close the tab. ("You came back. You told me you love storms.")

The playground was the experiment. This is the product.

## The contract (from `planning/BACKEND_PLAN.md`)

Build exactly this shape; the site and Abbas's brain and ears parts depend on it.

```ts
summon(part: "voice" | "memory", opts?: {
  tier?: "auto" | "tiny" | "small" | "full";
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
}): Promise<Handle>;              // rejects with a CircleError

type Progress = {
  stage: "checking" | "downloading" | "warming-up" | "ready";
  loadedBytes: number;
  totalBytes: number;             // real total from the library, never a guess
  fromCache: boolean;
};

voice.speak(text: string): Promise<{ samples: Float32Array; sampleRate: number }>
memory.remember(text: string): Promise<void>
memory.recall(query: string, k?: number): Promise<string[]>   // most similar first
memory.forget(): Promise<void>                                // wipe all memories
handle.banish(): void                                         // unload, free memory

type CircleError = {
  code: "NO_WEBGPU" | "OUT_OF_MEMORY" | "LOW_STORAGE"
      | "DOWNLOAD_FAILED" | "MODEL_LOAD_FAILED" | "ABORTED";
  part: PartId; message: string;
};
```

## What to build

| File | What it does |
|---|---|
| `circle/src/workers/protocol.ts` | Message types. In: `{ id, type: "load" \| "run" \| "abort", part, payload }`. Out: `{ id, type: "progress" \| "result" \| "chunk" \| "error", payload }`. Audio and vectors go across as transferable `ArrayBuffer`s, never copied. |
| `circle/src/workers/part.worker.ts` | Runs inside the worker: loads the model, answers `run` messages, posts progress. |
| `circle/src/parts/voice.ts` | Voice part. Splits long text into sentences so the first one can play while the next is made. |
| `circle/src/parts/memory.ts` | Memory part. Embeds text, stores `{ text, vector, time }` in IndexedDB, recalls top `k` by cosine similarity. |
| `circle/src/parts/cosine.ts` | Pure maths: cosine similarity and top-k, with no model, so it is easy to test. |
| `circle/src/summon.ts` | `summon()`: picks the tier from the sigil, starts the worker, maps every failure to a `CircleError`, and retries once on the next lighter tier. |
| `circle/src/index.ts` | Export `summon` and the types. |

**Rules:**

- **Tier choice comes from your measurements.** Use Kokoro on a tier only if it makes speech **faster than real time** there (less time to generate than the audio lasts). Otherwise that tier returns a typed error, and the site falls back to the browser's built-in voice. On `tiny`, memory can be a keyword match with no model.
- **Storage:** IndexedDB through `idb` (version `8.0.4` on npm; verify the API in its README first, then add it to `local-ai.md`). Survives reloads, never leaves the device.
- **Abort works everywhere:** aborting during download or during `speak` rejects with `ABORTED` and leaves no half-loaded model.
- **Errors are always typed.** Never throw a raw string or `Error` out of `summon`.
- Update the playground so it calls `summon()` instead of the libraries directly. That proves the real code works in a browser.

## Tests

Unit tests with a **fake worker** (no model downloads in tests), and property tests with `fast-check`:

1. **Every request gets exactly one answer:** for any sequence of requests, each `id` gets exactly one `result` or `error`, never zero or two.
2. **Fallback always gets lighter:** a failed load either retries on a strictly lighter tier or ends in a `CircleError`, never a heavier tier or a loop.
3. **Cosine is sane:** symmetric, a normalized vector scores 1 against itself, and every score is between −1 and 1.
4. **Recall is ordered and bounded:** `recall(q, k)` returns at most `k` items, sorted from most to least similar.
5. **Forget means forgotten:** after `forget()`, `recall` returns an empty list.

## How to do it in Kiro

1. Pull `main` and create branch `feature/voice-memory-parts`.
2. Do the Task 02 fixes first, as a separate commit.
3. **Spec mode**, paste:
   > Create a spec called voice-memory-parts from planning/tasks/task-03-voice-memory-parts.md. Implement the summon contract for the voice and memory parts in circle/src, with inference in a Web Worker. Use only model IDs, options and APIs recorded in .kiro/steering/local-ai.md; if one is missing, verify it in the official README and add it there first. Requirements in EARS format, with the five properties as property-based tests.
4. **Agent hook:** when anything in `circle/src/parts/` or `circle/src/workers/` is saved, run `npm test -w circle`.
5. **Steering:** add a short `.kiro/steering/workers.md` covering the message protocol and the rule that models load only inside workers, never on the main thread.
6. Keep `planning/kiro-notes.md` going: where Kiro tried to guess an API and what stopped it.

## Done when

- [ ] Task 02 fixes done: WebGPU voice measured, entries complete in template format, tier names fixed, hook and notes committed
- [ ] `summon("voice")` and `summon("memory")` work from the playground, with real progress
- [ ] Memories survive a page reload
- [ ] Abort and every failure produce a typed `CircleError`
- [ ] 5 property tests plus unit tests pass, and the typecheck is clean
- [ ] `npm run build -w site` still passes (the site must keep deploying)
- [ ] Spec in `.kiro/specs/voice-memory-parts/`, hook and `workers.md` committed
- [ ] Pull request into `main` by **Wed 25 Nov**

## Not part of this task

Wiring the parts into the lab (the jars, the switch, the first words), and the brain and ears parts. Abbas builds those on top of your protocol from 26 November.
