import type { CircleError, Progress } from "./workers/protocol.js";
export type Tier = "auto" | "tiny" | "small" | "full";
const TIER_ORDER: Tier[] = ["full", "small", "tiny"];
export async function summon(part: "voice" | "memory", opts?: { tier?: Tier; onProgress?: (p: Progress) => void; signal?: AbortSignal }) {
  const tiers = opts?.tier && opts.tier !== "auto" ? [opts.tier] : TIER_ORDER;
  let lastError: CircleError | null = null;
  for (const tier of tiers) {
    try {
      if (opts?.signal?.aborted) throw { code: "ABORTED", part, message: "Aborted" } as CircleError;
      if (part === "voice" && tier !== "full") throw { code: "NO_WEBGPU", part, message: `Kokoro not used on ${tier} tier, use browser voice` } as CircleError;
      if (part === "memory" && tier === "tiny") {
        return { speak: undefined, remember: async () => {}, recall: async () => [], forget: async () => {}, banish: async () => {} };
      }
      const worker = new Worker(new URL("./workers/part.worker.ts", import.meta.url), { type: "module" });
      return await loadPart(worker, part, tier, opts);
    } catch (e) {
      lastError = e as CircleError;
      if (lastError.code === "ABORTED") throw lastError;
      continue;
    }
  }
  throw lastError ?? ({ code: "MODEL_LOAD_FAILED", part, message: "All tiers failed" } as CircleError);
}
function loadPart(worker: Worker, part: "voice" | "memory", tier: string, opts: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const onAbort = () => { worker.terminate(); reject({ code: "ABORTED", part, message: "Aborted" } as CircleError); };
    opts?.signal?.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data as any;
      if (m.type === "progress") opts?.onProgress?.(m.payload);
      if (m.type === "result") {
        resolve({
          speak: async (text: string) => {
            const res = await callWorker(worker, part, text, opts);
            return { samples: new Float32Array(res.samples), sampleRate: res.sampleRate };
          },
          remember: async () => {},
          recall: async () => [],
          forget: async () => {},
          banish: async () => { worker.terminate(); },
        });
      }
      if (m.type === "error") { worker.terminate(); reject(m.payload); }
    };
    worker.postMessage({ id: 1, type: "load", part, payload: { tier } });
  });
}
let nextId = 2;
function callWorker(worker: Worker, part: string, text: string, opts: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const handler = (e: MessageEvent) => {
      const m = e.data as any;
      if (m.id !== id) return;
      worker.removeEventListener("message", handler);
      if (m.type === "result") resolve(m.payload);
      else reject(m.payload);
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ id, type: "run", part, payload: { text } });
  });
}
