---
inclusion: fileMatch
fileMatchPattern: "{apps,site}/**"
---

# Design language: the reanimation lab

The page is a black-and-white 1930s film still, and **only electricity has color**. Full rationale: `planning/design-plan.md`.

## Palette (CSS custom properties in `site/src/styles.css`)

| Token | Value | Use |
|---|---|---|
| `--stone` | `#2b2a2e` | page background |
| `--stone-deep` | `#1f1e22` | wells, inset surfaces |
| `--line` | `#4a4850` | rules and outlines |
| `--silver` | `#d9d6cf` | primary text, engraving lines |
| `--silver-dim` | `#a19d95` | secondary text |
| `--copper` / `--copper-hi` | `#c47a3a` / `#e0995a` | things the user can act on: the switch, jar lids, links |
| `--arc` / `--arc-hot` | `#9fc2ff` / `#e6f0ff` | electricity and anything the AI produced |
| `--suture` | `#b23a3a` | stitch thread only |

Never add a color outside these. Never use green-on-black.

## Type

- **Display:** Big Shoulders Display 900/700, for headings and part names.
- **Body:** Newsreader.
- **Mono:** IBM Plex Mono, only for real instrument readouts (sizes, counts, gauges).
- Sentence case. No all-caps labels. Numbers in readouts use tabular figures.

## Motion

- One orchestrated moment: stitch the parts, throw the switch, the coils charge, lightning arcs, the creature wakes. Everything else stays still.
- UI easing `cubic-bezier(0.2, 0, 0, 1)`. Pressed buttons scale to 0.96 over 150 ms. Draggable controls use critically damped springs from the current value, rubber-band at the ends, and can be interrupted.
- At most one soft full-screen flash, never strobing. Under `prefers-reduced-motion` there is no flight, no lightning and no flash: states cross-fade.
- Hover styles only inside `@media (hover: hover)`.

## The creature

Our own anatomical-engraving bust: sutures, copper temple clamps, sockets for five parts. **No flat head, no neck bolts, no green skin**, and no names, imagery or makeup design from any film.

## Sound

Off by default, toggled in the header, fully synthesized with Web Audio. No audio files.

## Accessibility

- Text contrast at least 4.5:1. Every control has an accessible name and a visible copper focus ring.
- The knife switch works by drag, click and keyboard (Enter or Space).
- Anything the creature says is shown as an on-screen subtitle.
