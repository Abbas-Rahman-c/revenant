# Implementation Plan: Device Sigil

## Overview

The device sigil is already implemented and working in `circle/src/sigil/` (`types.ts`, `tier.ts`, `probe.ts`) plus the public entry point (`circle/src/index.ts`) and tests (`tier.test.ts`, `probe.test.ts`). These tasks do **not** rewrite that implementation. They verify the existing code against the finalized requirements and design, then complete the remaining "Done when" deliverables from `planning/tasks/task-01-device-sigil.md`: browser API notes in the steering file, the on-save test hook, the Kiro write-up notes, the spec commit, and the pull request.

The verification tasks map directly to the requirements' test-coverage table, which binds the five unit tests (U1–U5) and five property-based tests (P1–P5) to specific acceptance criteria.

## Tasks

- [ ] 1. Verify the existing implementation satisfies the spec
  - [ ] 1.1 Run the sigil tests and confirm all are green
    - Run `npm test -w circle` (Vitest in `--run` mode) and confirm the 5 unit tests and 5 property-based tests pass.
    - Confirms the test-coverage table: U1 (Req 1.1), U2 (Req 2.3), U3 (Req 2.4), U4 (Req 1.3 & 2.5), U5 (Req 1.4), plus the fallback-adapter (Req 4.2) and every-API-throws (Req 4.1) cases; P1 (Req 3.1), P2 (Req 1.5), P3 (Req 1.6), P4 (Req 3.2), P5 (Req 2.1 & 2.2).
  - [ ] 1.2 Run the strict typecheck and confirm it passes
    - Run `npm run typecheck -w circle` (`tsc --noEmit`, strict mode) and confirm zero errors.
    - Confirms Requirement 6: `probeDevice`/`chooseTier` are callable function exports; `Tier`, `DeviceFacts`, `Sigil`, `TierReason`, `BrowserEnv` are usable as type-only imports.
  - [ ] 1.3 Confirm `probeDevice` never throws
    - Verify the existing `probe.test.ts` "every API throws" case passes and that the partial-failure path still populates non-throwing facts.
    - Confirms Requirement 4.1, 4.2, 4.3 (never-throw guarantee and per-API isolation).
  - [ ] 1.4 Verify and complete TSDoc coverage on the public exports
    - Confirm every public `circle` function (`probeDevice`, `chooseTier`) and each exported type (`Tier`, `DeviceFacts`, `Sigil`, `TierReason`, `BrowserEnv`) has a short TSDoc comment. Add missing comments only — do not change any runtime logic.
    - Satisfies the tech rule: "Every public `circle` function has a TSDoc comment and a test."
    - _Requirements: 6.1, 6.2_

- [ ] 2. Complete the remaining "Done when" deliverables
  - [ ] 2.1 Record verified browser API notes in the steering file
    - Add a browser-API section (not model entries) to `.kiro/steering/local-ai.md` for the APIs the probe reads: `navigator.gpu.requestAdapter()` + `limits.maxBufferSize` + `info.description`; `isFallbackAdapter` with the deprecation note (moving to `GPUAdapterInfo`); `navigator.deviceMemory` (Chrome-only, clamped); `navigator.hardwareConcurrency`; `navigator.storage.estimate()` (`quota - usage`). Source each from current MDN/spec docs as recorded in `design.md`.
    - Satisfies the project rule: "if it is not written here, look it up before using it."
  - [ ] 2.2 Add the on-save test hook
    - Create a v2 hook in `.kiro/hooks/` that runs the sigil tests when a file in `circle/src/sigil/` is saved: trigger `PostFileSave`, matcher `circle/src/sigil/.*\.ts$`, command `npm test -w circle -- --run`.
    - Satisfies the task doc step 5: "when a file in `circle/src/sigil/` is saved, run the sigil tests."
  - [ ] 2.3 Write the Kiro write-up notes
    - Add `planning/kiro-notes.md` with short notes on what the spec got right or wrong, and whether the property tests caught anything the unit tests missed (they should not, since the implementation predates this spec, but record the actual observation).
    - Satisfies the task doc step 6 and the Kiro write-up deliverable.

- [ ] 3. Checkpoint - Ensure all tests pass, ask the user if questions arise.
  - Re-run `npm test -w circle` after the TSDoc and steering changes; ensure all tests pass, ask the user if questions arise.

- [ ] 4. Commit and open a pull request
  - [ ] 4.1 Commit the spec and hook
    - Commit `.kiro/specs/device-sigil/` (requirements, design, tasks) and the hook in `.kiro/hooks/`, plus the TSDoc and steering edits, on the `feature/device-sigil` branch.
  - [ ] 4.2 Open a pull request into `main`
    - Open a PR into `main` with a short description and the test output (paste the Vitest summary showing the 5 unit + 5 property tests green and the typecheck passing).

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP (none here are marked optional; all are required "Done when" items).
- The implementation is already complete and working; no task rewrites `types.ts`, `tier.ts`, `probe.ts`, or the test files. Task 1.4 only adds TSDoc comments.
- Each verification task references the requirements/ACs it confirms, for traceability back to the test-coverage table.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "2.1", "2.2", "2.3"] },
    { "id": 1, "tasks": ["4.1"] },
    { "id": 2, "tasks": ["4.2"] }
  ]
}
```
