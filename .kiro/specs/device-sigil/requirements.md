# Requirements Document

## Introduction

The device sigil is the first piece of the Summoning Circle runtime (`circle/`). Before the runtime downloads any model, it must know what the host device can run. The sigil probes the browser once and answers two questions: what does this device have (WebGPU, memory, free storage, cores), and which model size tier should the runtime use — `none`, `tiny`, `small`, or `full`.

This spec covers two functions and their supporting types. `chooseTier(facts)` is a pure decision function: the same `DeviceFacts` in always produce the same tier and reasons out, with no browser access. `probeDevice(env?)` reads the browser into a `Sigil`; it accepts an injectable `BrowserEnv` so tests can fake any device, and it never throws — a missing or failing browser API becomes an `undefined` fact rather than a crash.

The code already exists in `circle/src/sigil/`. This document specifies the behavior that code must satisfy. Implementation details — the exact reason-selection cascade, the public export surface, and how the real environment is wired — belong in the design document.

## Glossary

- **chooseTier**: The pure function `chooseTier(facts: DeviceFacts): { tier: Tier; reasons: TierReason[] }` that maps device facts to a tier and reasons, with no browser access.
- **probeDevice**: The async function `probeDevice(env?: BrowserEnv): Promise<Sigil>` that reads the browser into a `Sigil`.
- **DeviceFacts**: The raw capabilities read from the browser: `webgpu`, `gpuName`, `maxBufferMB`, `memoryGB`, `cores`, `freeStorageMB`. A field is `undefined` when the browser did not report it.
- **BrowserEnv**: The injectable bundle of browser APIs (`requestAdapter`, `deviceMemory`, `hardwareConcurrency`, `storageEstimate`) that `probeDevice` reads from. Tests pass a fake; the real environment is used by default.
- **Sigil**: The result of probing: `{ facts: DeviceFacts; tier: Tier; reasons: TierReason[] }`.
- **Tier**: The model size class: `"none"`, `"tiny"`, `"small"`, or `"full"`.
- **TierReason**: A code explaining why a higher tier was not chosen: `"NO_WEBGPU"`, `"LOW_MEMORY"`, `"LOW_STORAGE"`, `"SMALL_GPU_BUFFER"`, or `"UNKNOWN_MEMORY"`.
- **WebGPU**: The browser GPU API. `webgpu` is `true` only when `probeDevice` finds a real, non-fallback adapter.
- **GPU buffer**: The largest GPU buffer the adapter allows, reported as `maxBufferMB` in megabytes.
- **memoryGB**: `navigator.deviceMemory`, in gigabytes.
- **freeStorageMB**: Free site storage (`storage.estimate()` quota minus usage), in megabytes.
- **full tier**: The largest model size. Requires WebGPU, a known `memoryGB` of 8 or more, a known `freeStorageMB` of 4,000 or more, and a known `maxBufferMB` of 1,024 or more.
- **small tier**: Requires WebGPU, a known `freeStorageMB` of 1,000 or more, and a `memoryGB` of 4 or more (or `memoryGB` unknown).
- **tiny tier**: Requires a known `freeStorageMB` of 200 or more. Runs on the CPU; WebGPU is not required.
- **none tier**: The device cannot run any model tier.
- **fallback adapter**: A WebGPU adapter marked `isFallbackAdapter: true` (a software renderer). A fallback adapter counts as no WebGPU.

## Requirements

### Requirement 1: Tier Selection

**User Story:** As a developer using the Circle runtime, I want chooseTier to select the highest model size tier a device can run, so that models load at the largest size that will not crash the device.

#### Acceptance Criteria

1. WHEN DeviceFacts has `webgpu` true, a known `memoryGB` of 8 or greater, a known `freeStorageMB` of 4,000 or greater, and a known `maxBufferMB` of 1,024 or greater, THE chooseTier SHALL return tier `full`.

   **Property-based test required:** No (unit test — U1, strong gaming laptop).

2. WHEN DeviceFacts has `webgpu` true, a known `freeStorageMB` of 1,000 or greater, and either a known `memoryGB` of 4 or greater or an unknown `memoryGB`, and at least one condition for tier `full` specified in criterion 1 is not satisfied, THE chooseTier SHALL return tier `small`.

   **Property-based test required:** No (unit test).

3. WHEN DeviceFacts has a known `freeStorageMB` of 200 or greater and neither the conditions for tier `small` (criterion 2) nor the conditions for tier `full` (criterion 1) are satisfied, THE chooseTier SHALL return tier `tiny`.

   **Property-based test required:** No (unit test — U4, old phone).

4. WHEN DeviceFacts has a known `freeStorageMB` less than 200 or an unknown `freeStorageMB`, THE chooseTier SHALL return tier `none`.

   **Property-based test required:** No (unit test — U5, storage almost full).

5. WHEN DeviceFacts has `webgpu` false, THE chooseTier SHALL return tier `tiny` or `none`.

   **Property-based test required:** Yes — P2 (no WebGPU, no GPU tiers).

6. WHEN chooseTier selects a tier for any DeviceFacts with a known `freeStorageMB`, THE selected tier SHALL be one whose minimum `freeStorageMB` requirement is no greater than the device's `freeStorageMB`, where the minimum `freeStorageMB` requirement is 4,000 for `full`, 1,000 for `small`, 200 for `tiny`, and tier `none` has no `freeStorageMB` requirement.

   **Property-based test required:** Yes — P3 (fits the device).

### Requirement 2: Tier Reasons

**User Story:** As a developer building the creature app, I want chooseTier to report why a higher tier was not chosen, so that the app can show honest diagnostics to the visitor.

#### Acceptance Criteria

1. WHEN chooseTier returns tier `full`, THE chooseTier SHALL return a reasons list containing zero TierReason entries.

   **Property-based test required:** Yes — P5 (reasons are honest, full case).

2. WHEN chooseTier returns a tier other than `full`, THE chooseTier SHALL return a reasons list containing at least one TierReason.

   **Property-based test required:** Yes — P5 (reasons are honest, non-full case).

3. WHEN DeviceFacts has `webgpu` true, `memoryGB` of 8, `freeStorageMB` of 1,500, and `maxBufferMB` of 2,048, THE chooseTier SHALL return tier `small` with reasons equal to `["LOW_STORAGE"]`.

   **Property-based test required:** No (unit test — U2).

4. WHEN DeviceFacts has `webgpu` true, `memoryGB` undefined (unknown), `freeStorageMB` of 10,000, and `maxBufferMB` of 2,048, THE chooseTier SHALL return tier `small` with reasons equal to `["UNKNOWN_MEMORY"]`.

   **Property-based test required:** No (unit test — U3, Safari-like).

5. WHEN DeviceFacts has `webgpu` false, `memoryGB` of 2, `maxBufferMB` undefined, and `freeStorageMB` of 500, THE chooseTier SHALL return tier `tiny` with a reasons list that contains `"NO_WEBGPU"`.

   **Property-based test required:** No (unit test — U4).

### Requirement 3: Tier Selection Properties

**User Story:** As a developer, I want chooseTier to behave predictably as device capabilities change, so that upgrading a device never reduces the chosen tier and repeated probes give the same answer.

#### Acceptance Criteria

1. WHEN device B has at least as much of every capability as device A — for each of `memoryGB`, `freeStorageMB`, and `maxBufferMB`, the field is known on both devices with B's value greater than or equal to A's, or unknown on both and treated as equal; `webgpu` true counts as more than `webgpu` false; and no numeric field is known on one device but unknown on the other — THE chooseTier SHALL return a tier for B whose rank is not lower than the rank for A, where the rank order is `none` < `tiny` < `small` < `full`.

   **Property-based test required:** Yes — P1 (more never hurts).

2. WHEN chooseTier is called twice with the same DeviceFacts (equal values for every field), THE chooseTier SHALL return the same tier and the same `reasons` array — the same `TierReason` values in the same order — on both calls.

   **Property-based test required:** Yes — P4 (deterministic).

### Requirement 4: Device Probe Robustness

**User Story:** As a developer, I want probeDevice to probe any browser without crashing, so that the creature app works even on browsers with missing or broken APIs.

#### Acceptance Criteria

1. IF every browser API in BrowserEnv throws or is missing, THEN THE probeDevice SHALL return a Sigil object with `facts`, `tier`, and `reasons` present, `facts.webgpu` set to `false`, and all optional fields (`gpuName`, `maxBufferMB`, `memoryGB`, `cores`, `freeStorageMB`) `undefined`, and SHALL NOT throw.

   **Property-based test required:** No (unit test — every API throws).

2. WHEN the WebGPU adapter returned by BrowserEnv has `isFallbackAdapter` true, THE probeDevice SHALL set `webgpu` to `false` in the returned DeviceFacts, and SHALL leave `gpuName` and `maxBufferMB` `undefined`.

   **Property-based test required:** No (unit test — software fallback adapter).

3. WHEN an individual browser API in BrowserEnv throws, THE probeDevice SHALL leave `webgpu` as the boolean `false` and the corresponding optional fields as `undefined`, and SHALL continue probing the remaining APIs so that fields sourced from non-throwing APIs are still populated.

   **Property-based test required:** No (edge case).

### Requirement 5: Device Probe Fact Reading

**User Story:** As a developer, I want probeDevice to read real browser capabilities into DeviceFacts, so that chooseTier can make an accurate tier decision.

#### Acceptance Criteria

1. WHEN a non-fallback WebGPU adapter is available, THE probeDevice SHALL set `webgpu` true, set `gpuName` from the adapter's `info.description` (or `undefined` when `info.description` is absent), and set `maxBufferMB` by dividing the adapter's `limits.maxBufferSize` (coerced to a `number`, handling `bigint`) by 1,048,576 (or `undefined` when `maxBufferSize` is absent or null).

   **Property-based test required:** No (unit test).

2. WHEN BrowserEnv provides `deviceMemory` and `hardwareConcurrency` as numbers, THE probeDevice SHALL set `memoryGB` to `deviceMemory` and `cores` to `hardwareConcurrency`.

   **Property-based test required:** No (unit test).

3. WHEN BrowserEnv's `storageEstimate` returns numeric `quota` and `usage`, THE probeDevice SHALL set `freeStorageMB` to `quota` minus `usage` divided by 1,048,576.

   **Property-based test required:** No (unit test).

4. WHEN probeDevice is called with no BrowserEnv argument, THE probeDevice SHALL read from the real browser environment.

   **Property-based test required:** No (verified by smoke test).

5. WHEN probeDevice finishes reading the browser, THE probeDevice SHALL return a Sigil whose `facts` are the read DeviceFacts, whose `tier` is the result of chooseTier, and whose `reasons` are the result of chooseTier.

   **Property-based test required:** No (unit test).

### Requirement 6: Public API

**User Story:** As an app developer, I want the circle package to expose probeDevice, chooseTier, and their types from a single entry point, so that I can build features without reaching into internal files.

#### Acceptance Criteria

1. THE circle package SHALL export `probeDevice` and `chooseTier` as runtime-callable functions from the public entry point `circle/src/index.ts`, such that each imported symbol is assertable at runtime via `typeof === 'function'`.

   **Property-based test required:** No (verified by typecheck and import).

2. THE circle package SHALL export the types `Tier`, `DeviceFacts`, `Sigil`, `TierReason`, and `BrowserEnv` from the public entry point `circle/src/index.ts` as type-only exports, confirmable via typecheck with no corresponding runtime value.

   **Property-based test required:** No (verified by typecheck and import).

## Test Coverage

The acceptance criteria map to the five unit tests and five property-based tests required by `planning/tasks/task-01-device-sigil.md`:

| Test | Type | Covered by |
|---|---|---|
| U1 — strong gaming laptop gets `full`, no reasons | Unit | Requirement 1, AC 1 |
| U2 — 8 GB memory, 1.5 GB storage gets `small` `["LOW_STORAGE"]` | Unit | Requirement 2, AC 3 |
| U3 — Safari-like, memory unknown gets `small` `["UNKNOWN_MEMORY"]` | Unit | Requirement 2, AC 4 |
| U4 — old phone gets `tiny` with `"NO_WEBGPU"` | Unit | Requirement 1, AC 3 and Requirement 2, AC 5 |
| U5 — storage almost full gets `none` | Unit | Requirement 1, AC 4 |
| Software fallback adapter treated as `webgpu` false | Unit | Requirement 4, AC 2 |
| Every API throws returns a valid Sigil, never throws | Unit | Requirement 4, AC 1 |
| P1 — more never hurts | Property | Requirement 3, AC 1 |
| P2 — no WebGPU, no GPU tiers | Property | Requirement 1, AC 5 |
| P3 — chosen tier fits device storage | Property | Requirement 1, AC 6 |
| P4 — deterministic | Property | Requirement 3, AC 2 |
| P5 — reasons are honest | Property | Requirement 2, AC 1 and AC 2 |
