# Task 01: The device sigil

**Owner:** Sunaina · **Size:** small, about 2 to 3 days · **Area:** `circle/src/sigil/` · **Build it in:** Kiro (Spec mode)

---

## What and why

Before the Circle downloads any model, it has to know **what this device can handle**. A gaming laptop can run a big model; an old phone can't. If we guess wrong, the page crashes or downloads 2 GB for nothing.

The **sigil** is the first piece of the engine. It looks at the browser once and answers two questions:

1. **What does this device have?** (graphics card, memory, free storage)
2. **Which model size should we use?** (`tiny`, `small` or `full`, or `none` if nothing fits)

Everything else in the engine depends on this answer, so it's the right place to start. It is also small, self-contained and easy to test: no AI models, no network, just browser APIs and logic.

---

## What to build

### Files

```
circle/
├── package.json          name "circle", type "module", scripts: test, typecheck
├── tsconfig.json         strict mode
├── vitest.config.ts
└── src/
    ├── index.ts          export { probeDevice, chooseTier } and the types
    └── sigil/
        ├── types.ts      DeviceFacts, Tier, Sigil, TierReason
        ├── probe.ts      probeDevice(): reads the browser
        ├── tier.ts       chooseTier(): pure decision logic
        ├── probe.test.ts
        └── tier.test.ts
```

Also add `"circle"` to the `workspaces` list in the root `package.json`.

### The types (the contract other code will rely on)

```ts
export type Tier = "none" | "tiny" | "small" | "full";

/** Raw facts read from the browser. undefined means the browser didn't say. */
export type DeviceFacts = {
  webgpu: boolean;          // a real (not software) WebGPU adapter was found
  gpuName?: string;         // e.g. "intel gen-12lp"
  maxBufferMB?: number;     // largest GPU buffer the adapter allows
  memoryGB?: number;        // navigator.deviceMemory (Chrome only, capped at 8)
  cores?: number;           // navigator.hardwareConcurrency
  freeStorageMB?: number;   // storage quota minus what is already used
};

export type TierReason =
  | "NO_WEBGPU"             // no adapter, or only a software one
  | "LOW_MEMORY"
  | "LOW_STORAGE"
  | "SMALL_GPU_BUFFER"
  | "UNKNOWN_MEMORY";       // allowed, but we were careful

export type Sigil = {
  facts: DeviceFacts;
  tier: Tier;
  reasons: TierReason[];    // why we didn't pick a higher tier (empty if "full")
};
```

### The functions

```ts
/** Reads the browser. Never throws: any API that fails or is missing becomes undefined. */
probeDevice(env?: BrowserEnv): Promise<Sigil>

/** Pure decision. Same facts in, same answer out. No browser access. */
chooseTier(facts: DeviceFacts): { tier: Tier; reasons: TierReason[] }
```

`BrowserEnv` is a small object holding the browser bits `probeDevice` needs (`navigator.gpu`, `navigator.deviceMemory`, `navigator.storage`, and so on). The real one is used by default; **tests pass in a fake one** to simulate any device. This is the key design idea of the task.

### Tier rules

Check from the top; the first row that fits wins.

| Tier | Needs all of these |
|---|---|
| `full` | WebGPU · memory 8 GB or more (known) · free storage 4,000 MB or more · GPU buffer 1,024 MB or more |
| `small` | WebGPU · memory 4 GB or more, **or unknown** · free storage 1,000 MB or more |
| `tiny` | free storage 200 MB or more (runs on the CPU, no WebGPU needed) |
| `none` | anything else |

Unknown values: unknown **memory** is allowed for `small` (Safari and Firefox don't report it) but adds `UNKNOWN_MEMORY`. Unknown **storage** or **GPU buffer** counts as "not enough" for the tier that needs it.

For each requirement a higher tier failed, add the matching reason. Example: a laptop with WebGPU, 8 GB of memory but only 1.5 GB free storage gets `small` with reasons `["LOW_STORAGE"]`.

### Browser APIs to use

**Check each of these in the current official docs (MDN, the WebGPU spec) before using it,** and add what you confirm to `.kiro/steering/local-ai.md`. That's our project rule: no guessed APIs.

- `navigator.gpu.requestAdapter()`, then the adapter's `limits.maxBufferSize` and `info` (vendor, architecture), plus how the current spec marks a **software fallback adapter**. A fallback adapter counts as no WebGPU.
- `navigator.deviceMemory`
- `navigator.hardwareConcurrency`
- `navigator.storage.estimate()`: use `quota - usage` for free storage

There's a simpler early version of this in `site/src/probe.ts` (the landing page uses it). Read it for reference, but write the new one properly to this spec.

---

## Tests

Use **Vitest** for unit tests and **fast-check** for property-based tests. Pin exact versions in `package.json`.

### Unit tests (`tier.test.ts`, `probe.test.ts`)
- A strong gaming laptop gets `full` with no reasons.
- The example above gets `small` with `["LOW_STORAGE"]`.
- Safari-like (WebGPU, memory unknown, plenty of storage) gets `small` with `["UNKNOWN_MEMORY"]`.
- An old phone (no WebGPU, 500 MB free) gets `tiny` with `["NO_WEBGPU"]`.
- Storage almost full (50 MB free) gets `none`.
- A software fallback adapter is treated as `webgpu: false`.
- `probeDevice` with a fake env where **every API throws** still returns a valid sigil (tier from whatever is known) and **never throws**.

### Property-based tests (fast-check) in `tier.test.ts`
These are the ones judges like to see, because Kiro supports them directly:
1. **More never hurts:** if device B has at least as much of everything as device A, B's tier is never lower than A's. (Having WebGPU counts as more than not having it. Only compare a value when it is known on both devices or unknown on both; "unknown" is not smaller or bigger than a number.)
2. **No WebGPU, no GPU tiers:** if `webgpu` is false, the tier is always `tiny` or `none`.
3. **Fits the device:** the chosen tier's storage requirement is never more than the free storage.
4. **Deterministic:** `chooseTier` gives the same answer for the same facts every time.
5. **Reasons are honest:** `full` always has an empty reasons list; any other tier has at least one reason.

---

## How to do it in Kiro

1. Pull the latest `main`, then create a branch: `feature/device-sigil`.
2. Open Kiro in **Spec mode** and start with:

   > Create a spec called `device-sigil` from `planning/tasks/task-01-device-sigil.md`. Write requirements with acceptance criteria in EARS format. Mark which criteria need property-based tests (all five in the Tests section). Then write the design and the task list.

3. Review Kiro's requirements and design **before** letting it write code. Fix anything that doesn't match this doc.
4. Run the tasks one by one. After each, run `npm test -w circle`.
5. Add one **agent hook**: when a file in `circle/src/sigil/` is saved, run the sigil tests.
6. Write short notes in `planning/kiro-notes.md`: what the spec got right or wrong, and whether property tests caught anything the unit tests missed. We need these for the Kiro write-up.

---

## Done when

- [ ] `npm test -w circle` passes: all unit and property tests green
- [ ] `npm run typecheck -w circle` passes with strict mode
- [ ] `probeDevice()` never throws, even with every browser API broken
- [ ] Every public function and type has a short TSDoc comment
- [ ] Verified API notes added to `.kiro/steering/local-ai.md`
- [ ] `.kiro/specs/device-sigil/` (requirements, design, tasks) committed
- [ ] The test hook is committed in `.kiro/hooks/`
- [ ] A pull request into `main` with a short description and the test output

## Not part of this task

- Downloading or running any model
- Changing the landing page (we'll switch it to this module later)
- The model registry and the worker pool (next tasks)

## Stuck?

Push what you have to your branch and message the group. A half-finished branch is better than a silent day.
