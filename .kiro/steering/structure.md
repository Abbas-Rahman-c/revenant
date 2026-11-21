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
│       ├── index.ts    public API only: summon(), openEyes(), types, CircleError
│       ├── summon.ts   tier choice from the sigil, fallback, typed handles
│       ├── handles.ts  typed wrappers: ask, transcribe, speak, remember/recall
│       ├── sigil/      device probe (WebGPU, memory, storage) and tier choice
│       ├── parts/      registry.ts (the only place model IDs live), one <part>.impl.ts per worker part,
│       │               eyes.ts (main thread), progress, text helpers
│       ├── workers/    protocol, host (worker side), conn (main side), one <part>.worker.ts each
│       └── test/       FakeWorker: runs the real worker host in-process for tests
│   └── playground/     test bench page (npm run playground -w circle)
├── circle-mcp/         MCP server Kiro uses while building (.kiro/settings/mcp.json)
├── scripts/            guards run by hooks: check-local-ai.mjs, check-registry.mjs
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
- One part per file in `circle/src/parts/` (`<part>.impl.ts`), with its worker entry in `circle/src/workers/<part>.worker.ts`.
- `site/` imports only from `circle`'s public entry point, never its internal files.
