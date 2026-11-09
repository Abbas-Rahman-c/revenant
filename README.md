# Summoning Circle

> Stitch a mind into your browser.

A **Kiroween 2026** entry in the **Frankenstein** category.

Five AI models, each built on a different web technology, sewn into one creature that lives entirely on your device:

| Part | What it does | Built on |
|---|---|---|
| Brain | thinks and answers | a small language model on WebGPU |
| Eyes | sees what the camera sees | object detection with MediaPipe and WebAssembly |
| Ears | hears and writes down speech | Whisper speech-to-text in WebAssembly |
| Voice | speaks out loud | text-to-speech played through Web Audio |
| Memory | remembers you between visits | text embeddings stored in the browser |

No server, no API bill. Model files download once; your camera, voice and words never leave the tab.

> 🚧 Under construction. Built during the Kiroween 2026 submission period (Oct 30 – Dec 4, 2026). The lab in `site/` works today with simulated loading; the real models are being wired up now.

## Repository layout

| Folder | What lives there |
|---|---|
| `.kiro/` | Kiro specs, steering docs and hooks used to build this project |
| `site/` | The creature app: the lab, then talk mode |
| `circle/` | The runtime that loads and runs each part in the browser |
| `circle-mcp/` | MCP server Kiro uses while building |
| `power/` | The Kiro power package |
| `benchmark/` | Testing Kiro with and without the power |
| `planning/` | Plans and task docs ([backend plan](planning/BACKEND_PLAN.md)) |

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## How Kiro was used

See [`.kiro/`](.kiro) and, at submission time, the Kiro write-up in this README.

## Credits

- **Body anatomy (skin, skeleton, muscles, brain, heart):** BodyParts3D, © The Database Center for Life Science, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Meshes reduced and combined for the web.
- **3D rendering:** [three.js](https://threejs.org) (MIT).

## License

Code: [MIT](LICENSE). Third-party assets keep their own licenses (see Credits).
