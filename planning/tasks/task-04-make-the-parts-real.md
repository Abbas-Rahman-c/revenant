# Task 04: Make the voice and memory parts real

**Owner:** Sunaina · **Dates:** Fri 20 to Tue 24 November · **Area:** `circle/src/`, `circle/playground/`, `.kiro/` · **Build it in:** Kiro

---

## Task 03 review

Merged as PR #3. **22 tests pass**, the typecheck is clean and the site still deploys. What is good:

- **The protocol types match the contract exactly** (`protocol.ts`), and the worker really loads Kokoro on WebGPU and MiniLM, sending audio and vectors back as transferable buffers.
- **`cosine.ts` is correct**, and its two property tests are real: symmetric, a vector scores 1 against itself, every score is between -1 and 1, and top-k is ordered and bounded.
- **The IndexedDB code in `memory.ts` is a good start**, and `workers.md` and the test hook are the right Kiro moves.

But the parts don't work yet. The shape is there, the inside is not:

1. **Memory is fake.** `summon("memory")` returns `remember`, `recall` and `forget` that do nothing. `memory.ts` is never called. Remembering the visitor is the whole point of this part.
2. **There is no progress.** The worker never posts a `progress` message, so `onProgress` never fires and the jars' load bars would stay at zero.
3. **Abort is broken.** The abort listener is never removed, so aborting *after* loading kills a working voice. Aborting during `speak` does nothing, and the worker ignores `abort` messages.
4. **The errors aren't always typed.** Every worker failure becomes `MODEL_LOAD_FAILED`, even one that happens while speaking. If `new Worker()` itself throws, a raw `Error` can leak out of `summon`.
5. **The tests don't touch `summon`.** "Exactly one answer" checks an array the test built itself. "Fallback gets lighter" checks a constant list. "Forget" checks `topK([])`. All three would pass even if `summon` were deleted.
6. **`splitSentences` loses text.** `"Hello. World"` returns only `["Hello."]`. And `speak` doesn't use it.
7. **The Kiro work is missing:**
   - No spec in `.kiro/specs/voice-memory-parts/`.
   - `circle-test.json` uses a different format from `sigil-test.json`, so it may never run. Check that Kiro's Agent Hooks panel shows it and that it fires.
   - `kiro-notes.md` hasn't changed since Task 01.
8. **`local-ai.md` was cut off again (the third time).** It ended in the middle of the voice snippet, with an unclosed code block. The template, the memory entry and your browser-API section were gone. I restored them and kept your new voice details. It still has blanks (`___ MB`, the cached load time), and the WebGPU speed for the voice was never written down.
9. **Small things:**
   - `idb` is `^8.0.4` but must be exact.
   - The lockfile fetched `idb` from a mirror (`registry.npmmirror.com`), so reinstall it from the normal registry.
   - Memories are keyed by `time`, so two remembered in the same millisecond overwrite each other.
   - The playground still calls the libraries directly instead of `summon()`.

None of this is unusual for a first pass. This task finishes it.

---

## What and why

From 26 November Abbas wires these parts into the lab: the jars, the switch and the creature's first words. He can only do that if `summon()` really works. **This task makes every promise in the contract true**, and proves it with tests that call the real code.

## 1. Protect `local-ai.md` first (30 min)

Add the hook from Task 02, in the **same format as `sigil-test.json`** (check that it shows in Kiro's Agent Hooks panel): on save of `.kiro/steering/local-ai.md`, run a small script (`scripts/check-local-ai.mjs`) that fails if:

- any `<placeholder>`, `___` or "TO FILL" is left,
- the number of ` ``` ` marks is odd (an unclosed code block),
- any of these headings is missing: `Template`, `Voice`, `Memory`, `Verified browser APIs`.

Then fill the remaining blanks with measured numbers. Most important: the voice's **real-time factor on WebGPU** (generate time ÷ audio length). If it is not below 1.0, Kokoro can't be the creature's voice on that machine.

## 2. Make `summon()` keep its promises

| Promise | What it means in code |
|---|---|
| **Typed handles** | `summon("voice")` returns a `VoiceHandle` (`speak`, `banish`). `summon("memory")` returns a `MemoryHandle` (`remember`, `recall`, `forget`, `banish`). No `any` in the public types. |
| **Real memory** | `remember(text)`: the worker embeds it, then `memory.ts` stores it. `recall(query, k)`: embed the query, return the top `k` texts. Use `autoIncrement` keys. Memories survive a reload. |
| **Keyword memory on `tiny`** | No model: `recall` scores by shared words. It uses the same `MemoryHandle` type, so the site never needs to know. |
| **Real progress** | Pass the library's progress callback to `from_pretrained` and `pipeline`, and forward each update as a `progress` message. **Verify the option name in each README** and add it to `local-ai.md` first; don't guess. |
| **Abort, everywhere** | During load: terminate the worker and reject with `ABORTED`. During `speak` or `recall`: reject that call with `ABORTED`. After load, abort only cancels work in flight; it never kills a loaded handle. Remove the listener once settled. |
| **Typed errors** | Load failures → `MODEL_LOAD_FAILED` or `DOWNLOAD_FAILED`, failures during a call → their own message, and any unknown throw is wrapped. Nothing but a `CircleError` ever leaves `summon` or a handle. |
| **Long speech** | `speak` splits the text with a fixed `splitSentences` (keep the text after the last full stop) and returns the joined audio. Optionally, add `speakStream` that yields one sentence at a time, so the first plays sooner. |
| **Testable** | `summon` takes an optional `createWorker` function (default: the real worker), so tests can pass in a fake one. |

## 3. Tests that call the real code

Write a `FakeWorker` (in `circle/src/test/`) that answers messages the way a script tells it to: succeed, fail, delay, or answer out of order. For IndexedDB in Node, use `fake-indexeddb` (`6.2.8` on npm, Apache-2.0; verify its README and pin it exactly).

Property tests with `fast-check`:

1. **Exactly one answer:** for any mix of calls with random delays and answer order, every promise settles exactly once, with the answer for *its* `id`.
2. **Fallback gets lighter:** for any set of tiers the fake fails, `summon` tries tiers in strictly lighter order, never retries one, and ends with a handle or a `CircleError`.
3. **Only typed errors escape:** whatever the fake throws (strings, `Error`s, `undefined`), the caller gets a `CircleError` with a valid `code`.
4. **Abort is clean:** aborting at any moment ends with `ABORTED` (or the result, if it already arrived), and the worker is terminated only if loading had not finished.
5. **Forget means forgotten:** after any sequence of `remember` calls and then `forget()`, `recall` returns `[]`. Before `forget`, recalling a text you remembered returns it first.

Plus unit tests: `splitSentences` (keeps trailing text, handles empty input) and keyword memory on `tiny`.

## 4. Turn the playground into a test bench

Rewrite `circle/playground/main.ts` to use **only** `summon()`:

- A **Summon voice** button with a real progress bar and an **Abort** button, then a text box and **Speak**.
- **Summon memory**, a text box with **Remember**, a **Recall** box that shows the top 3 with scores, and **Forget**.
- A tier selector (`auto`, `tiny`, `small`, `full`), so you can see the fallbacks working.

Check by hand: remember three things, reload the page, recall one. It must still be there.

## How to do it in Kiro

1. Pull `main` and create branch `feature/parts-real`.
2. Commit step 1 (the hook and blanks) on its own first.
3. **Spec mode**, paste:
   > Create a spec called voice-memory-parts from planning/tasks/task-04-make-the-parts-real.md. The existing code in circle/src/summon.ts, circle/src/workers/ and circle/src/parts/ is a first pass; make every promise in the table true. Use only APIs recorded in .kiro/steering/local-ai.md; verify any new option (such as the progress callback) in the official README and add it there first. Requirements in EARS format, with the five properties as property-based tests that call summon through a fake worker.
4. **Before you commit any `.kiro/steering/` file, read its diff.** If Kiro deleted sections, put them back.
5. Make `circle-test.json` match the format of `sigil-test.json`, then save a file in `circle/src/parts/` and watch it fire.
6. Add the Task 02, 03 and 04 notes to `planning/kiro-notes.md`: where Kiro guessed, and where it cut `local-ai.md`.

## Done when

- [ ] The `local-ai.md` check hook exists and passes, with no blanks left and the WebGPU real-time factor recorded
- [ ] Voice and memory handles are typed, with no `any` in public types
- [ ] Remember, reload, recall works in the playground
- [ ] The progress bar moves with real bytes, and Abort works during load and during speak
- [ ] The 5 property tests call `summon` through `FakeWorker`, and all tests pass
- [ ] `npm run typecheck -w circle` and `npm run build -w site` pass
- [ ] Spec in `.kiro/specs/voice-memory-parts/`, both hooks in the right format, and Kiro notes updated
- [ ] `idb` and `fake-indexeddb` pinned exactly, installed from `registry.npmjs.org`
- [ ] Pull request into `main` by **Tue 24 Nov**

## Not part of this task

Wiring the parts into the lab, and the brain and ears parts. Abbas builds those on this from 26 November.
