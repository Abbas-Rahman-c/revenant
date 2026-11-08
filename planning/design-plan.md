# Design plan: the Frankenstein lab

Category: **Frankenstein**, "stitch together a chimera of technologies into one app." Our chimera: five browser AI parts (eyes, ears, brain, voice, memory), each built on a different technology, stitched into one creature that lives inside a browser tab.

## Brief
- **Subject:** a toolkit that runs AI models inside the browser, presented as a reanimation lab.
- **Audience:** hackathon judges first (five seconds to get it), web developers second.
- **Primary job:** let the visitor stitch the parts onto the creature, throw the switch and watch it come alive, then explain what each part really is.

## The idea that keeps it from looking generated
**The page is a black-and-white 1930s film still, and only electricity is in color.** Stone, silver and grain everywhere, then copper and arc-blue appear only where power flows: the switch, the coils, the lightning, and anything the AI says. Color has a job, and the job is "this is alive."

## Defaults rejected

| Axis | The default | Our choice |
|---|---|---|
| Palette | near-black plus acid green (the stock Frankenstein look) | silver-nitrate greys, with copper and arc-blue only for power |
| Creature | flat head, neck bolts, green skin | Our own anatomical-engraving bust with sutures and copper temple clamps. That classic look belongs to one film studio's makeup design, so we stay clear of it. |
| Hero | headline, stat, gradient | A working operating table you play with |
| Sections | identical rounded cards | an anatomy plate with leader lines, an instrument panel with real needles, a film end card |
| Motion | fade-up on every section | one orchestrated reanimation; needles settle once; everything else still |
| Type | Inter + a trendy serif | Newsreader (newsreel-era text), Big Shoulders Display (1930s poster weight), IBM Plex Mono only on real instrument readouts |

## Tokens
- **Greys:** stone `#2b2a2e`, stone-deep `#1f1e22`, slate line `#4a4850`, silver `#d9d6cf`, silver-dim `#a19d95`
- **Power:** copper `#c47a3a` (things you can do), arc `#9fc2ff` (things the AI produced), arc-hot `#e6f0ff` (lightning core)
- **Suture** `#b23a3a`, used only for stitch thread
- **Type scale (1.25):** 14 / 17 / 21 / 26 / 33 / 41 / 52 / 80 px. Large display tracks −0.02em; mono labels +0.02em.
- **Motion:** UI easing `cubic-bezier(0.2, 0, 0, 1)`. Press scales to 0.96 over 150 ms. Springs are critically damped, with bounce only after a throw. Everything is gated behind `prefers-reduced-motion`.

## Layout
```
┌──────────────────────────────────────────────────────────┐
│ Summoning Circle                         sound  GitHub    │
│                                                           │
│  Stitch a mind      ┌─coil┐   creature    ┌coil─┐  jars:  │
│  into your browser. │     │   on slab     │     │  eyes   │
│  short line         └─────┘  sockets+     └─────┘  ears   │
│                              sutures              brain   │
│  [ knife switch ]                                 voice   │
│  3 of 5 parts stitched                            memory  │
├──────────────────────────────────────────────────────────┤
│ Anatomy plate: creature + leader lines to each part       │
├──────────────────────────────────────────────────────────┤
│ Vital signs: real needles for GPU, memory, storage, cores │
├──────────────────────────────────────────────────────────┤
│ How the lab works: bench / notebook / creature            │
├──────────────────────────────────────────────────────────┤
│ The End?                                                  │
└──────────────────────────────────────────────────────────┘
```
Text left-aligned. On phones: creature first, jars in a row under it, switch below.

## The one big moment
1. The visitor clicks a specimen jar. The part flies to its socket and sutures sew around it.
2. The knife switch can be dragged down 1:1 with the pointer, or pressed with Enter or Space. Released early, it springs back.
3. Thrown: the coils charge, each part's load bar fills (labeled as a preview until the runtime exists), then lightning arcs from the coils to the temple clamps. One soft flash, never strobing.
4. Alive: the eyes open (if stitched), the heart trace starts, and the creature says one line that depends on which parts it got.

## Rules
- One soft flash at most, and none under reduced motion (photosensitivity).
- Sound is off by default and fully synthesized with Web Audio: no audio files, no licensing questions.
- Fonts are self-hosted; the page makes no third-party requests.
- No film names, studio characters or makeup designs anywhere.
