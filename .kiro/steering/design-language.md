---
inclusion: fileMatch
fileMatchPattern: "apps/**"
---

# Design language: candlelit ritual

The look is a ritual circle drawn in light on a dark floor: occult, warm and elegant, never cheap or gory. Spooky elements must do a job.

## Palette (CSS custom properties)

| Token | Value | Use |
|---|---|---|
| `--void` | `#0d0a14` | page background |
| `--ash` | `#1a1524` | panels and cards |
| `--bone` | `#ede6d6` | primary text |
| `--dust` | `#9b92a8` | secondary text |
| `--ember` | `#ff8a3d` | primary accent, active states, candlelight |
| `--spectre` | `#a78bfa` | secondary accent, links, AI-generated content |
| `--blood` | `#e5484d` | errors only |

Each app may add one signature color: Possessed can add a lurid green; 3 AM uses a moonlit blue.

## Type

- Display: a serif with character (for example Cormorant Garamond or IM Fell) for titles only.
- Body and UI: a clean sans (for example Inter). Code: a monospace.

## Motion

- Slow, breathing motion: flicker, drift, glow. No jump scares in the default experience.
- Every animation has a `prefers-reduced-motion` fallback.

## Signature components

- **Summoning circle loader:** a circle of sigils that draws itself as model chunks download. It shows real progress: bytes loaded, model name and size. Never a fake spinner.
- **Spirit card:** shows which model is running, on which backend (WebGPU or WASM), and its tier.
- **Offline seal:** a small badge that lights up when the app is running with no network, proving nothing leaves the device.

## Accessibility

- Text contrast at least 4.5:1 against `--void` and `--ash`.
- Anything spoken by an app is also captioned on screen.
- Every control is reachable by keyboard and has a visible focus ring in `--ember`.
