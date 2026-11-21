# Launch kit

Deadline: **Fri 4 Dec 2026, 2:00 PM PT (Sat 5 Dec, 3:00 AM Pakistan)**. Plan: submit **Thu 3 Dec**.

## Submission checklist

- [ ] Both of you submit the Kiro credits form (deadline **Tue 1 Dec**)
- [ ] Repo is public, has an OSI license (MIT, done) and the `.kiro/` folder (done)
- [ ] Working URL: https://revenant-sigma-eight.vercel.app
- [ ] Demo video under 3 minutes, uploaded to YouTube (public or unlisted)
- [ ] Devpost: category **Frankenstein**, tick **Best Student Project** (both NUST students)
- [ ] Kiro write-up in the Devpost form (draft below; keep only what really happened in Kiro)
- [ ] Social post starting with `#KiroweenHackathon26`, and a short blog post that mentions Kiroween 2026 (optional bonus)
- [ ] Test the live URL on a second laptop and a phone the day before

## Devpost

**Name:** Revenant

**Tagline:** Stitch a mind into your browser.

**Elevator pitch (200 characters):**
Assemble a creature from five real AI models, throw the switch, and talk to it. It hears, thinks, speaks, sees and remembers you, entirely on your device. No server, no API keys.

**Inspiration**
Frankenstein built a body from parts and gave it life with lightning. Browsers can now run real AI models, but each one is its own library on its own technology: WebGPU, WebAssembly, Web Audio, IndexedDB, MediaPipe. We wanted to stitch them into one living thing, and make the stitches visible.

**What it does**
You enter a stormy 3D lab. A translucent body assembles itself on the table: bones, muscle, skin, sutures. You pick parts from specimen jars (brain, eyes, ears, voice, memory) and they fly onto the body. Throw the knife switch: the coils charge while each part's real model downloads (the load bars are the real bytes), lightning strikes, and it wakes. Then you talk to it. Hold the mic and it hears you (Whisper), thinks (Llama 3.2 1B on WebGPU), answers out loud one sentence at a time (Kokoro), remembers what you told it even after you close the tab (MiniLM embeddings in IndexedDB), and, if you open its eyes, sees what your camera sees (MediaPipe). Missing parts change it instead of breaking it: without ears you type, without memory it forgets you and says so.

**How we built it**
- `circle/` is a small runtime with one function, `summon(part)`. It probes the device, picks a tier (`tiny`, `small`, `full`), loads the part in its own Web Worker, reports real progress, and falls back to lighter models.
  - Every request gets exactly one answer, and only typed errors escape.
  - These rules are property-based tests that drive the real code through an in-process fake worker.
- `site/` is React and three.js: BodyParts3D anatomy, shader-built skin and electric veins, procedural lightning, and quality tiers so it runs on weak laptops.
- `circle-mcp/` is an MCP server, so the agent looks up real model IDs, licenses and GPU needs instead of inventing them.
- The steering file `local-ai.md` holds only verified, measured facts, and hooks guard it.

**Challenges**
- Agents invent local-AI APIs, so we made "never guess a model ID" a rule, a steering file, a hook and an MCP tool.
- Kokoro on WebAssembly was five times slower than real time. We measured it and restricted the voice to WebGPU, where it runs faster than real time.
- The first brain answer waited 30 s for shader compilation, so it now warms up while the coils charge.
- Small models wander, so memories go right next to the question.

**What we learned**
Measure everything on a real laptop. A 1B model on a laptop GPU is enough for a character, if you keep its answers short.

**What's next**
Publish `circle` as a package, so any web app can summon a part in one line.

**Built with:** TypeScript, React, three.js, WebGPU, WebAssembly, Web Workers, Web Audio, IndexedDB, WebLLM, Transformers.js, kokoro-js, MediaPipe, Vite, Vitest, fast-check, MCP, Kiro, Vercel.

## Kiro write-up (draft: keep only what is true)

- **Spec-driven development**
  - `device-sigil` and `voice-memory-models` were built in Kiro's spec mode (Sunaina): requirements in EARS form, design, tasks.
  - The device sigil's correctness properties became fast-check tests.
  - `circle-runtime` follows the same format. *Say how it was made: if it was not written in Kiro, do not claim it.*
- **Steering**
  - `local-ai.md` is a verified-facts file. A model ID, option or API may only be used once it is recorded with its source and measured numbers.
  - It stopped Kiro from guessing several times; Sunaina's notes in `planning/kiro-notes.md` record when.
  - `workers.md` loads only when runtime files are open.
- **Hooks**
  - Run the runtime tests on save.
  - Guard `local-ai.md`: an agent truncated it three times before this hook existed.
  - Check that every registry model ID is verified.
- **MCP:** `circle-mcp` gives the agent `check_model_id`, `webllm_models`, `hf_model_card` and `choose_tier`, all from real sources.
- **What we would tell other teams:** put the facts an agent tends to invent in steering, and make a hook enforce them.

## Demo video script (2:45)

| Time | Picture | Voice-over |
|---|---|---|
| 0:00 | Title gate, rain, thunder | "Every AI app you use sends your voice to a server. This one doesn't." |
| 0:08 | Enter the lab; the body assembles | "This is Revenant. A creature stitched from five real AI models, running entirely in this browser tab." |
| 0:25 | Click each jar; parts fly to the body | "Brain, ears, voice, memory and eyes. Each a different model on a different web technology: WebGPU, WebAssembly, Web Audio, IndexedDB, MediaPipe." |
| 0:45 | Throw the switch; load bars fill | "These bars are the real downloads. Each part loads in its own worker, sized to this laptop's GPU." |
| 1:00 | Lightning; "It's alive"; first words | (let it speak) |
| 1:10 | Hold the mic: "Hi, I'm Abbas. I love thunderstorms." It answers aloud | "It hears me with Whisper, thinks with Llama 3.2 on the GPU, and speaks with Kokoro, sentence by sentence." |
| 1:35 | Open its eyes; hold up a mug; ask "What do you see?" | "With the camera it sees, through MediaPipe." |
| 1:50 | Reload the page, wake it again, ask "What weather do I love?" | "And it remembers me, because memories live in IndexedDB on my device." |
| 2:05 | Wi-Fi off, reload, still talks | "Once downloaded, it works offline." |
| 2:15 | Unstitch the brain on a "phone"; scripted words | "On weaker devices it adapts: lighter models, or fewer parts, never a crash." |
| 2:25 | Quick cut: `.kiro/` specs, a hook firing, the MCP tool answering | "We built it with Kiro: specs, a verified-facts steering file, hooks that guard it, and an MCP server so the agent never guesses a model." |
| 2:40 | Creature on the slab, lightning | "Revenant. Stitch a mind into your browser." |

Record at 1080p. Load every model once before recording, so the demo runs from cache.
