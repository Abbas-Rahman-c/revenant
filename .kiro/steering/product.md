---
inclusion: always
---

# Product: Revenant

Revenant lets developers build AI apps that run entirely in the browser: no server, no API bill, no user data leaving the device. It is a Kiroween 2026 entry in the **Frankenstein** category: five browser AI parts, each on a different web technology, stitched into one creature.

## The three layers

1. **The bench** (`circle/`): the runtime. One entry point, `summon(part, options)`, that picks a model the device can run, loads it in a web worker, reports real progress, caches it for offline use and falls back to a lighter model on failure.
2. **The notebook** (`circle-mcp/`, `power/`): an MCP server and a Kiro power that stop coding agents from inventing local-AI APIs.
3. **The creature** (`site/`): one app. Visitors stitch five parts onto a body (brain, eyes, ears, voice, memory), throw the switch, and then talk to it through the camera and microphone. It sees, hears, answers out loud and remembers them. It uses only the runtime's public API.

The full wiring plan is `planning/BACKEND_PLAN.md`.

## Who it is for

- Web developers who want private, offline, zero-cost AI features but are put off by the plumbing.
- People who will not send their camera feed or their voice to a cloud server.

## Principles (in priority order)

1. **Private by default.** Camera, microphone and conversation never leave the device. Only model files are downloaded, once. No analytics that send user content.
2. **It must actually run.** Prefer a smaller model that works on a mid-range laptop over a bigger one that crashes.
3. **Lean runtime, rich creature.** Keep `circle/` small and readable. Size and polish belong in the creature.
4. **Honest numbers.** Sizes, progress and performance claims are measured, never estimated or invented.
5. **Spooky with a purpose.** Halloween visuals must also do a job (for example, the load bars that fill while the coils charge are the real download progress).

## Hackathon constraints

- All project code is written during the submission period (from Oct 30, 2026). Third-party libraries are allowed and listed in the README.
- The `.kiro/` folder stays in the repo and is never gitignored.
- The creature must be deployable as a free static site judges can open (it needs COOP/COEP headers, so not GitHub Pages).
