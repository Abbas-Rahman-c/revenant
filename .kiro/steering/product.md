---
inclusion: always
---

# Product: Summoning Circle

Summoning Circle lets developers build AI apps that run entirely in the browser: no server, no API bill, no user data leaving the device. It is a Kiroween 2026 entry in the **Frankenstein** category: five browser AI parts, each on a different web technology, stitched into one creature.

## The three parts

1. **The Circle** (`circle/`): the skeleton. A small runtime with one entry point, `summon(kind, options)`, that picks a model the device can run, loads it in a web worker, caches it in OPFS and falls back to a lighter model on failure.
2. **The Ritual** (`circle-mcp/`, `power/`): an MCP server and a Kiro power that stop coding agents from inventing local-AI APIs.
3. **Two apps** built only through the Circle's public API:
   - **Possessed** (`apps/possessed/`): camera-first. Objects get tracked eyes and a mouth, a personality and a voice, and they talk. Loud, live, funny.
   - **3 AM** (`apps/three-am/`): voice-first. A private dream journal: offline transcription, symbol and emotion tagging, patterns across nights, an illustrated "book of nights". Quiet and intimate.

## Who it is for

- Web developers who want private, offline, zero-cost AI features but are put off by the plumbing.
- Users who will not send their camera feed or their dreams to a cloud server.

## Principles (in priority order)

1. **Private by default.** Camera, microphone and journal data never leave the device. No analytics that send user content.
2. **It must actually run.** Prefer a smaller model that works on a mid-range laptop over a bigger one that crashes.
3. **Lean skeleton, rich apps.** Keep `circle/` small and readable. Size and polish belong in the apps.
4. **Honest numbers.** Benchmark results and performance claims are measured, never estimated or invented.
5. **Spooky with a purpose.** Halloween visuals must also do a job (for example, the summoning circle that draws itself *is* the download progress bar).

## Hackathon constraints

- All project code is written during the submission period (from Oct 30, 2026). Third-party libraries are allowed and listed in the README.
- The `.kiro/` folder stays in the repo and is never gitignored.
- Both apps must be deployable as free static sites that judges can open.
