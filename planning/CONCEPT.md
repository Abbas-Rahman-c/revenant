# Summoning Circle

**Kiroween 2026 · Skeleton Crew · Abbas Rahman & Sunaina Babar**

> Summon AI that lives entirely in the browser. No server, no API bill, no data leaving the device.

This is the planning doc we feed into Kiro. Kiro writes the code; this file says what we're building and why.

---

## 1. The problem

AI that runs in the browser works now. Small language models, Whisper speech recognition, text-to-speech voices and vision models all run locally on WebGPU. That means apps that are private by default, work offline and cost nothing to host.

Almost nobody builds them, because the plumbing hurts:

- Every model library has a different API, and they change monthly.
- Models are hundreds of MB. Downloads, caching and "your GPU can't run this" all need handling.
- Heavy inference freezes the page unless it runs in a worker.
- **Coding agents hallucinate these APIs.** They invent functions and model IDs that don't exist. This is the exact pain InteractionKit solved for MediaPipe, and it won 1st place last year.

## 2. The idea

There are three layers. Each one is a judging point.

### Layer 1: The Circle (the skeleton)
A small, readable runtime with one call:

```ts
const voice  = await summon("speech-to-text");          // picks the best Whisper the device can run
const mind   = await summon("llm", { tier: "auto" });   // WebGPU → WASM → smaller model, automatically
const answer = await mind.ask("...", { stream: true });
```

- **Device sigil:** probes WebGPU, memory and storage once, and picks a model tier that will actually run.
- **Spirit registry:** one typed list of verified models (LLM, speech-to-text, TTS, vision, embeddings, depth). Each entry has its size, tier and tested code.
- **Worker pool:** all inference runs off the main thread, with streaming, cancellation and progress events.
- **Cache:** models are stored once in OPFS (the browser's private file system) and work offline after the first load.
- **Fallback chain:** if a model fails, it drops to a lighter one instead of crashing.
- **Lean by rule:** the core stays small (target under about 1,500 lines). The heft goes into the apps and the Kiro tooling.

### Layer 2: The Ritual (the Kiro power)
This is what makes the project "make Kiro better at something hard":

- **Steering docs** that pin the real APIs, model IDs and constraints, so Kiro stops guessing.
- **`circle-mcp`, an MCP server** Kiro calls while building:
  - `probe_device`: runs a headless browser with WebGPU and reports what models fit
  - `list_spirits`: verified models, with working code for each
  - `benchmark_spirit`: load time, tokens per second, memory
  - `scaffold_app`: generates a new app on the skeleton
- **Hooks:** when the registry changes, regenerate types and docs. When an app changes, smoke-test both apps in a real browser.
- **Packaged as a Kiro power** so anyone can install it and build their own local AI app.

### Layer 3: Two apps that look nothing alike
Skeleton Crew requires two distinct apps, so we pick opposites:

| | **Possessed** | **3 AM** |
|---|---|---|
| Feel | Loud, live, camera-first, funny | Quiet, private, voice-first, intimate |
| What it does | Point the camera at any object. It gets tracked eyes and a mouth, a personality based on what it is, and a voice, and it talks back. Two objects in frame argue. Each object remembers you. | A dream journal you mumble into half asleep. It transcribes offline, tags symbols and emotions, finds patterns across nights, and turns each dream into an illustrated page in a "book of nights". |
| Models used | Vision (object detection), face/landmark tracking, LLM, TTS | Whisper, LLM, embeddings (for pattern search), on-device image or SVG art |
| Why it matters | Shows real-time, multimodal and delightful | Shows that the data is too private for the cloud, which is exactly why local AI exists |

Both apps are built **only** through the Circle API. That's the proof the skeleton is reusable.

## 3. What makes it worth it (the upgrades)

1. **The hallucination benchmark: our headline number.** Ask Kiro to build the same 10 local-AI apps twice, once without the power and once with it. Measure how many work on the first try. "Without: 2/10. With: 9/10" is the kind of proof judges remember. (Numbers TBD; we measure them, we don't invent them.)
2. **The summoning screen.** Model downloads are the worst part of browser AI, so we make them the best part. While a model loads, a glowing ritual circle draws itself, and each sigil fills in as a chunk arrives. It's functional (real progress) and spooky (the Costume Contest look in a Skeleton Crew entry).
3. **`npx summon create my-app`:** a CLI that scaffolds a new app from the skeleton in one command, so judges can try it in 30 seconds.
4. **Coven mode (stretch):** browsers on the same network share cached model files over WebRTC, so a classroom downloads a model once instead of 30 times.
5. **Honest offline proof:** in the video, turn on airplane mode and both apps keep working.

## 4. Repo layout (matches the Skeleton Crew rules)

```
summoning-circle/
├── .kiro/              # specs, steering, hooks: committed, never gitignored
├── circle/             # the skeleton runtime (the template)
├── circle-mcp/         # MCP server Kiro uses while building
├── power/              # Kiro power package
├── apps/
│   ├── possessed/      # app 1 (its own folder, as the rules require)
│   └── three-am/       # app 2
├── benchmark/          # hallucination benchmark prompts, runs and results
├── LICENSE             # MIT, visible in the GitHub About section
└── README.md
```

## 5. Who does what

| | Abbas | Sunaina |
|---|---|---|
| Core | Circle runtime, worker pool, cache, fallbacks | Summoning screen, design system, spooky visual language |
| Kiro | `circle-mcp`, hooks, the power, benchmark | Steering docs for UI, specs for both apps' UX |
| Apps | Model pipelines for both apps | Possessed UI (AR overlay) and 3 AM UI (book of nights) |
| Ship | Deploy, README, Kiro write-up | Video, Devpost page, social post, blog |

Swap freely. This is a starting point.

## 6. Timeline (deadline: Dec 4, 2:00 PM PT = Sat Dec 5, 3:00 AM Pakistan)

| Week | Goal |
|---|---|
| **1** (Oct 31–Nov 6) | Both request 4,000 Kiro credits. Repo, MIT license, `.kiro` steering. Kiro specs for the Circle. `summon("llm")` working end to end in a bare page. |
| **2** (Nov 7–13) | All model types in the registry, plus fallbacks, caching and the worker pool. `circle-mcp` with `probe_device` and `list_spirits`. Hooks running. |
| **3** (Nov 14–20) | Both apps working on real models. Summoning screen. Run the benchmark without the power (baseline). |
| **4** (Nov 21–27) | Package the power, re-run the benchmark with it. CLI. Polish, mobile, performance. Deploy both apps to free static hosting. Feature freeze. |
| **5** (Nov 28–Dec 3) | Video under 3 minutes, Devpost write-up, Kiro usage write-up, social post (#KiroweenHackathon26), blog post. **Submit Dec 3.** |

## 7. Rules checklist

- [ ] Every line of project code written on or after Oct 30 (no pre-existing code; disclose libraries)
- [ ] **Built with Kiro.** Use the Kiro IDE for the real development, and keep the specs, hooks and steering it produces
- [ ] `.kiro/` at the repo root, committed
- [ ] Public GitHub repo with an MIT license detected in the About section
- [ ] Two app folders (Skeleton Crew)
- [ ] Working public URLs for both apps, free for judges to use
- [ ] YouTube video under 3 minutes, no copyrighted music
- [ ] Kiro write-up covering specs, hooks, steering, MCP, powers, property-based tests and custom agents
- [ ] Bonus: Best Student Project (both students: LinkedIn, student emails, year, degree, school)
- [ ] Bonus: Social Blitz post starting with `#KiroweenHackathon26`
- [ ] Bonus: blog post that mentions Kiroween 2026
- [ ] Credit Request Form submitted by both of us (deadline Dec 1, but do it now)

## 8. Risks

| Risk | Plan |
|---|---|
| Models too big for judges' laptops | Tiny default tier, plus a clear "your device can run…" screen |
| WebGPU missing (some browsers) | WASM fallback; document Chrome or Edge as recommended |
| Library APIs change mid-build | Pin versions; steering docs record the exact versions |
| Benchmark numbers come out unimpressive | Report them honestly anyway; even a modest improvement with a clear method is credible |
| Scope creep | Coven mode and the CLI are stretch goals; cut them first |
