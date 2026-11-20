
## Task 01 device-sigil
I built probeDevice + chooseTier, tested 5 cases with plain Node because npm was blocked, all 5 passed (full, small, small, tiny, none). Code committed on feature/device-sigil, waiting to push to Revenant.

## Task 04 - Make Parts Real - DONE 2026-11-20

- local-ai.md fixed: no blanks, Memory + Voice + Storage, guard CHECK PASSED
- memory.ts: real IndexedDB + MiniLM, remember/recall/forget/forgetAll
- summon.ts: real progress, abort everywhere, splitSentences keeps trailing text, no fake memory
- part.worker.ts: understands init + speak/remember/recall/forget
- playground/main.ts: uses summon(), voice + memory PASS via summon()
- Tests: 22 passed, typecheck: 0 problems
