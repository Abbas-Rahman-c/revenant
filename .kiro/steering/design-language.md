---
inclusion: fileMatch
fileMatchPattern: "{apps,site}/**"
---

# Design language: chalk on slate

A ritual circle drawn in chalk on a slate floor, lit by candles. Occult and handmade, never gory or cheap. One bold element per screen; everything else stays quiet. Full rationale: `planning/design-plan.md`.

## Palette (CSS custom properties)

| Token | Value | Use |
|---|---|---|
| `--slate` | `#23272e` | page background |
| `--slate-deep` | `#1a1d22` | wells, code blocks, inset panels |
| `--chalk` | `#ebe6da` | primary text and drawn lines |
| `--chalk-dim` | `#a9a597` | secondary text, faint lines |
| `--candle` | `#f2a541` | anything the user can act on |
| `--spirit` | `#b9a6ff` | anything the AI produced |
| `--blood` | `#ff6b6b` | errors only |

Color has meaning: candle means "you can do this", spirit means "a model made this". Don't use them decoratively.

App worlds (each app owns one): **Possessed** `#9bff5a` on `#16210f`; **3 AM** `#9cc3ff` on `#121a2a`.

## Type

- **Display:** IM Fell English, for big headings only.
- **Body and UI:** Atkinson Hyperlegible.
- **Code:** JetBrains Mono, for real code only, not as decoration.
- Scale: 14 / 18 / 24 / 32 / 42 / 56 / 75 px. Sentence case. No all-caps labels.
- Fonts are self-hosted with `@fontsource` packages, never loaded from a third-party CDN.

## Motion

- Motion answers the user (summon, expand, confirm). The only ambient motion is a slow candle flicker.
- Every animation has a `prefers-reduced-motion` fallback.

## Signature components

- **Summoning circle:** chalk rings and sigils that light in candle color as model chunks download. It shows real progress (bytes, model name, size). Never a fake spinner; label it as a preview when the data is simulated.
- **Spirit card:** which model is running, on which backend (WebGPU or WASM), and its tier.
- **Offline seal:** lights up when the app runs with no network.

## Accessibility

- Text contrast at least 4.5:1 on `--slate` and `--slate-deep`.
- Anything an app speaks is also captioned on screen.
- Every control is keyboard reachable with a visible `--candle` focus ring.
