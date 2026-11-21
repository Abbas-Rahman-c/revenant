# circle-mcp

An MCP server for building with the circle runtime. It answers model questions from real sources, so an agent never guesses a model ID, size or license.

| Tool | Answers from |
|---|---|
| `verified_models` | `.kiro/steering/local-ai.md` entries and the part registry (`circle/src/parts/registry.ts`) |
| `check_model_id` | whether an ID is recorded as verified, and where |
| `webllm_models` | `prebuiltAppConfig.model_list` in the installed `@mlc-ai/web-llm` (IDs, VRAM, GPU features) |
| `hf_model_card` | the Hugging Face API: license, task, library, ONNX file sizes |
| `choose_tier` | the real `chooseTier` rule from `circle/src/sigil/tier.ts` |

Kiro loads it from `.kiro/settings/mcp.json`. To run it by hand:

```bash
node circle-mcp/src/server.mjs
```

Tests: `npm test -w circle-mcp`. Needs Node 23.6 or newer (it imports the TypeScript tier rule directly).
