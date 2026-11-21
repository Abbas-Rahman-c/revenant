// Memory part (runs in a worker). Stores what the visitor says in IndexedDB, so it survives a reload,
// and recalls by meaning (MiniLM embeddings) or, on the tiny tier, by shared words.

import { openDB, type IDBPDatabase } from "idb";
import { cosineSimilarity } from "./cosine.js";
import { fileProgress } from "./progress.js";
import { entryFor } from "./registry.js";
import { keywordScore } from "./text.js";
import { reply, type PartImpl } from "../workers/host.js";
import type { Memory } from "../types.js";

type Row = { id?: number; text: string; time: number; vector: Float32Array | null };
export type Embedder = (text: string) => Promise<Float32Array>;
export type EmbedderLoader = (model: string, onProgress: (e: unknown) => void) => Promise<Embedder>;

const DB = "revenant-memory";
const STORE = "memories";

async function defaultLoader(model: string, onProgress: (e: unknown) => void): Promise<Embedder> {
  const { pipeline } = await import("@huggingface/transformers");
  const extract = await pipeline("feature-extraction", model, { progress_callback: onProgress });
  return async (text) => {
    const out = await extract(text, { pooling: "mean", normalize: true });
    return new Float32Array(out.data as Float32Array);
  };
}

export function createMemoryImpl(opts: { loader?: EmbedderLoader; dbName?: string } = {}): PartImpl {
  let embed: Embedder | null = null;
  let db: IDBPDatabase | null = null;

  const open = () =>
    openDB(opts.dbName ?? DB, 2, {
      upgrade(d, oldVersion) {
        if (oldVersion < 2 && d.objectStoreNames.contains(STORE)) d.deleteObjectStore(STORE); // v1 had a different key
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      },
    });

  const str = (x: unknown, name: string) => {
    if (typeof x !== "string") throw new Error(`${name} must be text`);
    return x;
  };

  return {
    part: "memory",
    async load(tier, ctx) {
      db = await open();
      const entry = entryFor("memory", tier);
      if (!entry) throw new Error(`No memory model for the ${tier} tier`);
      if (entry.model === "keywords") {
        embed = null;
        ctx.progress({ stage: "ready", fraction: 1, loadedBytes: 0, totalBytes: 0, fromCache: true });
        return;
      }
      const p = fileProgress(ctx.progress);
      embed = await (opts.loader ?? defaultLoader)(entry.model, p.callback);
      p.warming();
      await embed("warm up");
      p.ready();
    },
    ops: {
      async remember(args) {
        const { text } = args as { text: unknown };
        const t = str(text, "text").trim();
        if (!t) throw new Error("Nothing to remember");
        const vector = embed ? await embed(t) : null;
        const id = await db!.add(STORE, { text: t, time: Date.now(), vector } satisfies Row);
        return reply(id as number);
      },
      async recall(args, ctx) {
        const { query, k } = args as { query: unknown; k?: unknown };
        const q = str(query, "query");
        const limit = typeof k === "number" && k > 0 ? Math.floor(k) : 5;
        const rows = (await db!.getAll(STORE)) as Row[];
        if (ctx.signal.aborted) throw new DOMException("Aborted", "AbortError");
        const qv = embed && rows.length ? await embed(q) : null;
        const scored: Memory[] = rows.map((r) => ({
          id: r.id!,
          text: r.text,
          time: r.time,
          score: qv && r.vector ? cosineSimilarity(qv, r.vector) : keywordScore(q, r.text),
        }));
        scored.sort((a, b) => b.score - a.score || b.time - a.time);
        return reply(scored.slice(0, limit));
      },
      async forget(args) {
        const { id } = (args ?? {}) as { id?: unknown };
        if (typeof id === "number") await db!.delete(STORE, id);
        else await db!.clear(STORE);
        return reply(true);
      },
    },
  };
}
