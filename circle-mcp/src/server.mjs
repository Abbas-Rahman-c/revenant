#!/usr/bin/env node
// circle-mcp: an MCP server that answers model questions from real sources, so the agent building
// Revenant never has to guess a model ID, a size or a license.
//
// Tools
//   verified_models   what .kiro/steering/local-ai.md records, and what the part registry uses per tier
//   check_model_id    is this ID verified? (the rule every model ID must pass)
//   webllm_models     search WebLLM's own prebuilt model list (IDs, VRAM, required GPU features)
//   hf_model_card     license, task, library and ONNX file sizes for a Hugging Face model
//   choose_tier       run the real device-sigil rule on a set of device facts

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { modelIdsIn, parseRegistry, sections, summarizeCard } from "./lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");
const text = (x) => ({ content: [{ type: "text", text: typeof x === "string" ? x : JSON.stringify(x, null, 2) }] });

const server = new McpServer({ name: "circle-mcp", version: "0.1.0" });

server.registerTool(
  "verified_models",
  {
    title: "Verified models",
    description:
      "Lists every model entry recorded in .kiro/steering/local-ai.md and the model the circle runtime registry uses for each part and tier. Use this before writing any code that names a model.",
    inputSchema: {},
  },
  async () => {
    const facts = read(".kiro/steering/local-ai.md");
    return text({
      entries: sections(facts).filter((s) => /VERIFIED/.test(s.title)).map((s) => ({ title: s.title, modelIds: modelIdsIn(s.body) })),
      registry: parseRegistry(read("circle/src/parts/registry.ts")),
    });
  },
);

server.registerTool(
  "check_model_id",
  {
    title: "Check a model ID",
    description: "Says whether a model ID is recorded in local-ai.md (verified) and in which entry. Unverified IDs must not be used until checked and recorded.",
    inputSchema: { id: z.string().min(1).describe("The exact model ID, for example onnx-community/whisper-tiny.en") },
  },
  async ({ id }) => {
    const hits = sections(read(".kiro/steering/local-ai.md")).filter((s) => s.body.includes(id) || s.title.includes(id));
    return text(
      hits.length
        ? { id, verified: true, entries: hits.map((h) => h.title) }
        : { id, verified: false, next: "Read the official model card or package source, run it in a browser, then add an entry to local-ai.md." },
    );
  },
);

server.registerTool(
  "webllm_models",
  {
    title: "Search WebLLM's model list",
    description:
      "Searches prebuiltAppConfig.model_list from the installed @mlc-ai/web-llm package. Returns real model IDs with VRAM needs and required GPU features (for example shader-f16).",
    inputSchema: {
      query: z.string().optional().describe("Part of a model ID, for example 'SmolLM2' or 'Llama-3.2'"),
      maxVramMB: z.number().optional().describe("Only models that need at most this much GPU memory"),
    },
  },
  async ({ query, maxVramMB }) => {
    const webllm = await import("@mlc-ai/web-llm");
    const pkg = JSON.parse(read("node_modules/@mlc-ai/web-llm/package.json"));
    const q = (query ?? "").toLowerCase();
    const models = webllm.prebuiltAppConfig.model_list
      .filter((m) => m.model_id.toLowerCase().includes(q))
      .filter((m) => maxVramMB === undefined || (m.vram_required_MB ?? Infinity) <= maxVramMB)
      .map((m) => ({
        id: m.model_id,
        vramMB: m.vram_required_MB,
        lowResource: m.low_resource_required,
        contextWindow: m.overrides?.context_window_size,
        requires: m.required_features ?? [],
      }));
    return text({ package: `@mlc-ai/web-llm@${pkg.version}`, count: models.length, models: models.slice(0, 40) });
  },
);

server.registerTool(
  "hf_model_card",
  {
    title: "Hugging Face model card",
    description: "Fetches a model's license, task, library and ONNX file sizes from the Hugging Face API.",
    inputSchema: { repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/).describe("owner/name, for example onnx-community/Kokoro-82M-v1.0-ONNX") },
  },
  async ({ repo }) => {
    const res = await fetch(`https://huggingface.co/api/models/${repo}?blobs=true`, { headers: { "user-agent": "circle-mcp" } });
    if (!res.ok) return text({ repo, error: `Hugging Face answered ${res.status}` });
    return text(summarizeCard(repo, await res.json()));
  },
);

server.registerTool(
  "choose_tier",
  {
    title: "Choose a device tier",
    description: "Runs the real chooseTier rule from circle/src/sigil/tier.ts on device facts and returns the tier and the reasons a higher one was refused.",
    inputSchema: {
      webgpu: z.boolean(),
      memoryGB: z.number().optional(),
      freeStorageMB: z.number().optional(),
      maxBufferMB: z.number().optional(),
    },
  },
  async (facts) => {
    const { chooseTier } = await import("../../circle/src/sigil/tier.ts");
    return text(chooseTier(facts));
  },
);

await server.connect(new StdioServerTransport());
