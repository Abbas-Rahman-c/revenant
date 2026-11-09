> **Superseded (8 Nov 2026).** We switched to the Frankenstein category with one creature app. The current plan is [BACKEND_PLAN.md](BACKEND_PLAN.md). This file is kept for history.

# Kiro kickoff guide

How to start building Summoning Circle in the Kiro IDE. Paste the prompts below into Kiro **one at a time**, in order. Each prompt is a starting point; review what Kiro produces before moving on.

The steering docs in `.kiro/steering/` load automatically, so Kiro already knows the product, the stack, the folder layout and the design language.

---

## Before you start (both teammates)

1. Submit the **Kiro Credit Request Form** for the free 4,000 credits (linked from the hackathon page). Deadline Dec 1, but do it now.
2. Install the **Kiro IDE** and sign in.
3. Open this folder (`Summoning Circle`) in Kiro.
4. Create a **public GitHub repo** named `summoning-circle`, then push this folder to it.
5. On GitHub, check that the **MIT license** shows in the About section.

---

## Step 1: Spec for the Circle runtime (use Spec mode)

> Create a spec called `circle-runtime` for the skeleton in `circle/`. Read `planning/CONCEPT.md` sections 2 and 3 first.
>
> Requirements should cover:
> - `summon(kind, options)` returning a typed handle for `llm`, `speech-to-text`, `tts`, `vision`, `embeddings`
> - the device sigil: detect WebGPU, estimate memory and storage, pick a tier (`tiny`, `small`, `full`)
> - a worker pool so all inference runs off the main thread, with streaming, cancellation and progress events
> - an OPFS model cache that works offline after the first load
> - a fallback chain: WebGPU, then WASM, then a smaller tier, with typed `CircleError` codes
> - `banish()` to unload a model and free memory
> - the core stays under about 1,500 lines
>
> Write acceptance criteria in EARS format. Mark which criteria should get property-based tests (for example: the tier chosen never needs more memory than the sigil reports; a failed load always ends in a lighter model or a typed error, never an unhandled exception).

Then let Kiro generate the design and the task list. Run the tasks one by one.

## Step 2: Verify real models before writing loaders (use Vibe mode)

> For each model kind in the `circle-runtime` spec, find a real, small, permissively licensed model that runs in the browser. Use the current official docs for Transformers.js and WebLLM; do not rely on memory. For each one, write a tiny test page, run it, and add a verified entry to `.kiro/steering/local-ai.md` using the template there. Do not write any loader code until its entry is verified.

## Step 3: Hooks (Agent Hooks panel)

Create these hooks in Kiro's hooks panel:

| Hook | Trigger | What the agent does |
|---|---|---|
| **Registry guard** | A file in `circle/src/spirits/` is saved | Check that every model ID used is listed in `local-ai.md`; flag anything that is not |
| **Lean skeleton** | A file in `circle/src/` is saved | Count lines in `circle/src` and warn if the total passes 1,500 |
| **Both apps still work** | A file in `circle/src/` is saved | Run the Playwright smoke tests for both apps |
| **Docs follow code** | A public function in `circle/src/index.ts` changes | Update the TSDoc and the `circle/README.md` API section |

## Step 4: The MCP server (Spec mode)

> Create a spec called `circle-mcp` for an MCP server in `circle-mcp/` with tools `probe_device` (runs headless Chromium with WebGPU and returns a sigil), `list_spirits` (returns verified entries from `local-ai.md` with snippets), `benchmark_spirit` (load time, tokens per second, peak memory) and `scaffold_app` (creates a new Vite app wired to the Circle). Then add it to `.kiro/settings/mcp.json` so Kiro can use it while building.

## Step 5: The apps (Spec mode, one spec each)

> Create a spec called `app-possessed` for `apps/possessed/`. Read `planning/CONCEPT.md` section 2, layer 3. It must import only from the `circle` package's public API.

> Create a spec called `app-three-am` for `apps/three-am/`. Same rules.

## Step 6: The benchmark

Before packaging the power, give a **fresh Kiro workspace without our steering, hooks or MCP** the same 10 local-AI app prompts (write them in `benchmark/prompts.md`). Record which ones work on the first try. Later, repeat with the power installed. Save raw results in `benchmark/results/`.

---

## Keep for the write-up

Judges score how well we used Kiro. As you go, jot notes in `planning/kiro-notes.md`:
- specs vs vibe coding: where each one worked better
- which hook saved the most time
- which steering rule fixed the most mistakes
- what property-based tests caught that unit tests missed
- what the MCP server made possible
