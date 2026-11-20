import { openDB } from "idb";
import { cosineSimilarity, topK } from "./cosine.js";
const dbPromise = () => openDB("revenant-memory", 1, {
  upgrade(db: any) { db.createObjectStore("memories", { keyPath: "time" }); },
});
export async function remember(text: string, vector: Float32Array) {
  const db = await dbPromise();
  await db.put("memories", { text, vector: Array.from(vector), time: Date.now() });
}
export async function recall(queryVector: Float32Array, k = 5): Promise<string[]> {
  const db = await dbPromise();
  const all = await db.getAll("memories");
  const scored = all.map((m: any) => ({
    text: m.text as string,
    score: cosineSimilarity(queryVector, new Float32Array(m.vector as number[])),
  }));
  return topK(scored, k);
}
export async function forget() {
  const db = await dbPromise();
  await db.clear("memories");
}
