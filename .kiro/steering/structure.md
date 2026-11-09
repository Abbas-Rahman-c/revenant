---
inclusion: always
---

# Project structure

```
revenant/
├── .kiro/              specs, steering, hooks (always committed)
├── site/               the creature app (Vite + React): the lab, then talk mode
├── circle/             the runtime, published as the `circle` package
│   └── src/
│       ├── index.ts    public API only: summon(), types, CircleError
│       ├── sigil/      device probe (WebGPU, memory, storage) and tier choice
│       ├── parts/      one file per part: brain, eyes, ears, voice, memory
│       ├── workers/    worker pool, message protocol and worker entry points
│       └── cache/      cache detection for offline use
├── circle-mcp/         MCP server used by Kiro while building
├── power/              Kiro power package (steering + hooks + MCP config)
├── benchmark/          prompts and results for testing Kiro with and without the power
└── planning/           plans and task docs (not code)
```

## Vocabulary (use these names in code and docs)

| Term | Meaning |
|---|---|
| **part** | one of the five capabilities: `brain`, `eyes`, `ears`, `voice`, `memory` |
| **summon** | load a part and return a ready-to-use handle |
| **sigil** | the result of probing a device: what it can run |
| **tier** | `tiny`, `small` or `full`: a size class picked from the sigil |
| **banish** | unload a part and free its memory |

## Conventions

- File names in kebab-case. Types and components in PascalCase.
- One part per file in `circle/src/parts/`.
- `site/` imports only from `circle`'s public entry point, never its internal files.
