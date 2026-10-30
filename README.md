# Summoning Circle

> Summon AI that lives entirely in the browser. No server, no API bill, no data leaving the device.

A **Kiroween 2026** entry in the **Skeleton Crew** category.

Summoning Circle has three parts:

- **The Circle** (`circle/`): a small runtime that loads and runs language, speech, voice and vision models locally on WebGPU, with one call: `summon("llm")`.
- **The Ritual** (`circle-mcp/`, `power/`): an MCP server and a Kiro power that teach Kiro to build local AI apps without inventing APIs.
- **Two apps** built only on the Circle:
  - [`apps/possessed`](apps/possessed): point your camera at any object and it comes alive and talks back.
  - [`apps/three-am`](apps/three-am): a private, offline voice dream journal.

> 🚧 Under construction. Built during the Kiroween 2026 submission period (Oct 30 – Dec 4, 2026).

## Repository layout

| Folder | What lives there |
|---|---|
| `.kiro/` | Kiro specs, steering docs and hooks used to build this project |
| `circle/` | The skeleton runtime (the template) |
| `circle-mcp/` | MCP server Kiro uses while building |
| `power/` | The Kiro power package |
| `apps/possessed/` | App 1 |
| `apps/three-am/` | App 2 |
| `benchmark/` | The hallucination benchmark: Kiro with and without the power |
| `planning/` | Concept and idea documents |

## How Kiro was used

See [`.kiro/`](.kiro) and, at submission time, the Kiro write-up in this README.

## License

[MIT](LICENSE)
