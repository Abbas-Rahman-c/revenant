---
inclusion: always
---

# Project structure

```
summoning-circle/
├── .kiro/              specs, steering, hooks (always committed)
├── circle/             the skeleton runtime, published as the `circle` package
│   └── src/
│       ├── index.ts    public API only: summon(), types, CircleError
│       ├── sigil/      device probe (WebGPU, memory, storage) and tier choice
│       ├── spirits/    model registry: one file per model kind
│       ├── workers/    worker pool and the worker entry points
│       ├── cache/      OPFS model cache
│       └── ui/         optional summoning-circle progress component
├── circle-mcp/         MCP server used by Kiro while building
├── power/              Kiro power package (steering + hooks + MCP config)
├── apps/
│   ├── possessed/      app 1: separate Vite app
│   └── three-am/       app 2: separate Vite app
├── benchmark/          hallucination benchmark prompts, runs and results
└── planning/           concept and idea documents (not code)
```

## Vocabulary (use these names in code and docs)

| Term | Meaning |
|---|---|
| **summon** | load and return a ready-to-use model handle |
| **spirit** | a model entry in the registry (kind, id, size, tier, loader) |
| **sigil** | the result of probing a device: what it can run |
| **tier** | `tiny`, `small` or `full`: a size class picked from the sigil |
| **banish** | unload a model and free its memory |

## Conventions

- File names in kebab-case. Types and components in PascalCase.
- One model kind per file in `circle/src/spirits/`.
- Each app has its own `README.md` explaining what it uses from the Circle.
