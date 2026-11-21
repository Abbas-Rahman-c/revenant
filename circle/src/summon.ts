// summon.ts - REAL summon with progress, abort, real memory
// Task 04 Step 3

import type { CircleError, Progress } from "./workers/protocol.js";

export type Tier = "auto" | "tiny" | "small" | "full";
const TIER_ORDER: Tier[] = ["full", "small", "tiny"];

export type SummonOpts = {
  tier?: Tier;
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
};

export type PartHandle = {
  speak?: (text: string) => Promise<{ samples: Float32Array; sampleRate: number }>;
  remember: (text: string) => Promise<number>;
  recall: (query: string, limit?: number) => Promise<{ id?: number; text: string; vector: number[]; time: number }[]>;
  forget: (id: number) => Promise<void>;
  banish: () => Promise<void>;
};

function throwAborted(part: "voice" | "memory"): never {
  throw { code: "ABORTED", part, message: "Aborted" } as CircleError;
}

// splitSentences: KEEP the trailing text! Old version dropped it.
export function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+["']?\s*|[^.!?]+$/g);
  if (!parts) return [];
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

export async function summon(part: "voice" | "memory", opts?: SummonOpts): Promise<PartHandle> {
    const tiers = opts?.tier && opts.tier !== "auto" ? [opts.tier] : (part === "voice" ? ["full"] : TIER_ORDER);
  let lastError: CircleError | null = null;

  for (const tier of tiers) {
    try {
      if (opts?.signal?.aborted) throwAborted(part);
      if (part === "voice" && tier !== "full") {
        throw { code: "NO_WEBGPU", part, message: "Kokoro not used on " + tier + " tier, use browser voice" } as CircleError;
      }
      if (part === "memory" && tier === "tiny") {
        // tiny: keyword-only, no model, but STILL remembers in memory (not fake empty!)
        const store: { id: number; text: string; vector: number[]; time: number }[] = [];
        let next = 1;
        return {
          remember: async (text: string) => {
            const id = next++;
            store.push({ id, text, vector: [], time: Date.now() });
            return id;
          },
          recall: async (query: string, limit = 5) => {
            const q = query.toLowerCase().split(/\s+/);
            const scored = store
              .map((m) => ({ ...m, score: q.filter((w) => m.text.toLowerCase().includes(w)).length }))
              .sort((a, b) => b.score - a.score);
            return scored.slice(0, limit);
          },
          forget: async (id: number) => {
            const i = store.findIndex((m) => m.id === id);
            if (i >= 0) store.splice(i, 1);
          },
          banish: async () => { store.length = 0; },
        };
      }
      const worker = new Worker(new URL("./workers/part.worker.ts", import.meta.url), { type: "module" });
      return await loadPart(worker, part, tier, opts);
    } catch (e) {
      const err = e as CircleError;
      if (err.code === "ABORTED") throw err;
      lastError = err;
      // try next tier
    }
  }
  throw lastError ?? ({ code: "NO_WEBGPU", part, message: "No tier worked" } as CircleError);
}

let nextId = 2;

function callWorker(worker: Worker, part: string, payload: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const handler = (e: MessageEvent) => {
      const m = e.data as { id: number; type: string; payload: unknown };
      if (m.id !== id) return;
      worker.removeEventListener("message", handler);
      if (m.type === "result") resolve(m.payload);
      else reject(m.payload);
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ id, type: "run", part, payload });
  });
}

function loadPart(worker: Worker, part: "voice" | "memory", tier: string, opts?: SummonOpts): Promise<PartHandle> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      worker.terminate();
      reject({ code: "ABORTED", part, message: "Aborted" } as CircleError);
    };
    opts?.signal?.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; payload: unknown };
      if (m.type === "progress") opts?.onProgress?.(m.payload as Progress);
      if (m.type === "result") {
        opts?.signal?.removeEventListener("abort", onAbort);
        resolve({
          speak: async (text: string) => {
            if (opts?.signal?.aborted) throwAborted(part);
            // Speak EVERY sentence, including trailing text without . ! ?
            const sentences = splitSentences(text);
            const all: number[] = [];
            let sampleRate = 24000;
            for (const s of sentences) {
              if (opts?.signal?.aborted) throwAborted(part);
              const res = await callWorker(worker, part, { op: "speak", text: s, tier }) as { samples: number[]; sampleRate: number };
              sampleRate = res.sampleRate;
              all.push(...res.samples);
            }
            return { samples: new Float32Array(all), sampleRate };
          },
          remember: async (text: string) => {
            if (opts?.signal?.aborted) throwAborted(part);
            const res = await callWorker(worker, part, { op: "remember", text, tier }) as { id: number };
            return res.id;
          },
          recall: async (query: string, limit = 5) => {
            if (opts?.signal?.aborted) throwAborted(part);
            const res = await callWorker(worker, part, { op: "recall", text: query, limit, tier }) as { items: { id?: number; text: string; vector: number[]; time: number }[] };
            return res.items;
          },
          forget: async (id: number) => {
            if (opts?.signal?.aborted) throwAborted(part);
            await callWorker(worker, part, { op: "forget", id, tier });
          },
          banish: async () => {
            worker.terminate();
          },
        });
      }
      if (m.type === "error") {
        opts?.signal?.removeEventListener("abort", onAbort);
        reject(m.payload);
      }
    };
    worker.postMessage({ id: 1, type: "init", part, payload: { tier } });
  });
}