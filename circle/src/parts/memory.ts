// memory.ts - REAL memory using IndexedDB + MiniLM
// Task 04 Step 2: no more fake memory!

import { openDB, type IDBPDatabase } from "idb";
import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { cosineSimilarity } from "./cosine";

export type MemoryItem = {
  id?: number;
  text: string;
  vector: number[];
  time: number;
};

let dbPromise: Promise<IDBPDatabase> | null = null;
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB("revenant-memory", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("memories")) {
          db.createObjectStore("memories", { keyPath: "id", autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      progress_callback: (p: unknown) => console.log(p),
    }) as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const out = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(out.data as Float32Array);
}

export async function remember(text: string): Promise<number> {
  const vector = await embed(text);
  const db = await getDb();
  const id = await db.put("memories", {
    text,
    vector,
    time: Date.now(),
  });
  return id as number;
}

export async function recall(query: string, limit = 5): Promise<MemoryItem[]> {
  const queryVector = await embed(query);
  const db = await getDb();
  const all = await db.getAll("memories") as MemoryItem[];
  const scored = all.map((m) => ({
    ...m,
        score: cosineSimilarity(new Float32Array(queryVector), new Float32Array(m.vector)),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export async function forget(id: number): Promise<void> {
  const db = await getDb();
  await db.delete("memories", id);
}

export async function forgetAll(): Promise<void> {
  const db = await getDb();
  await db.clear("memories");
}