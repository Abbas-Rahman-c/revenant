// Brain part (runs in a worker): a small chat model on WebGPU through WebLLM.
// API verified in @mlc-ai/web-llm 0.2.89: CreateMLCEngine(modelId, { initProgressCallback }),
// engine.chat.completions.create({ messages, stream: true }), engine.interruptGenerate(),
// prebuiltAppConfig.model_list (model IDs used here are in that list).

import { entryFor } from "./registry.js";
import { reply, type PartImpl } from "../workers/host.js";
import type { ChatMessage } from "../types.js";

type Engine = {
  chat: {
    completions: {
      create(req: {
        messages: ChatMessage[];
        stream: true;
        max_tokens?: number;
        temperature?: number;
      }): Promise<AsyncIterable<{ choices: { delta?: { content?: string | null } }[] }>>;
    };
  };
  interruptGenerate(): void;
  resetChat(): Promise<void>;
};

type Gpu = { requestAdapter(): Promise<{ features: { has(f: string): boolean } } | null> };

export function createBrainImpl(): PartImpl {
  let engine: Engine | null = null;
  let busy = false;
  let chosen = "";
  return {
    part: "brain",
    async load(tier, ctx) {
      const entry = entryFor("brain", tier);
      if (!entry) throw new Error(`No brain model for the ${tier} tier`);
      const gpu = (globalThis as { navigator?: { gpu?: Gpu } }).navigator?.gpu;
      const adapter = gpu ? await gpu.requestAdapter() : null;
      if (!adapter) throw new Error("WebGPU is not available: no adapter");
      const model = adapter.features.has("shader-f16") ? entry.model : (entry.modelNoF16 ?? entry.model);
      chosen = model;
      const { CreateMLCEngine, hasModelInCache } = await import("@mlc-ai/web-llm");
      const cached = await hasModelInCache(model).catch(() => false);
      engine = (await CreateMLCEngine(model, {
        initProgressCallback: (r: { progress: number; text: string }) => {
          // WebLLM reports a fraction and a text line, not bytes. Fetching is the first ~90%.
          const warming = /shader|compil|loading model from cache|finish/i.test(r.text) && r.progress > 0.85;
          ctx.progress({ stage: warming ? "warming-up" : "downloading", fraction: Math.min(0.99, r.progress), fromCache: cached });
        },
      })) as unknown as Engine;
      ctx.progress({ stage: "ready", fraction: 1, fromCache: cached });
    },
    ops: {
      async model() {
        return reply(chosen);
      },
      async ask(args, ctx) {
        const { messages, maxTokens } = args as { messages: ChatMessage[]; maxTokens?: number };
        if (!Array.isArray(messages) || messages.length === 0) throw new Error("No messages");
        if (busy) engine!.interruptGenerate();
        busy = true;
        const stop = () => engine!.interruptGenerate();
        ctx.signal.addEventListener("abort", stop, { once: true });
        let text = "";
        try {
          const stream = await engine!.chat.completions.create({
            messages,
            stream: true,
            max_tokens: typeof maxTokens === "number" ? maxTokens : 160,
            temperature: 0.8,
          });
          for await (const part of stream) {
            if (ctx.signal.aborted) break;
            const t = part.choices[0]?.delta?.content ?? "";
            if (t) {
              text += t;
              ctx.chunk(t);
            }
          }
        } finally {
          ctx.signal.removeEventListener("abort", stop);
          busy = false;
        }
        if (ctx.signal.aborted) throw new DOMException("Aborted", "AbortError");
        return reply(text);
      },
    },
  };
}
