import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { cosineSimilarity, topK } from "./cosine.js";
describe("cosine", () => {
  it("cosine is sane: symmetric, 1 vs itself, -1 to 1", () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: -10, max: 10 }), { minLength: 1, maxLength: 10 }), (arr) => {
      const a = new Float32Array(arr);
      const b = new Float32Array([...arr].reverse());
      const s1 = cosineSimilarity(a, b);
      const s2 = cosineSimilarity(b, a);
      expect(Math.abs(s1 - s2)).toBeLessThan(0.001);
      expect(s1).toBeGreaterThanOrEqual(-1.001);
      expect(s1).toBeLessThanOrEqual(1.001);
      const self = cosineSimilarity(a, a);
      if (a.some(v => v !== 0)) expect(Math.abs(self - 1)).toBeLessThan(0.001);
    }), { numRuns: 50 });
  });
  it("recall is ordered and bounded", () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: -10, max: 10 }), { minLength: 3, maxLength: 8 }), fc.integer({ min: 1, max: 3 }), (scores, k) => {
      const items = scores.map((s, i) => ({ text: `m${i}`, score: s }));
      const out = topK(items, k);
      expect(out.length).toBeLessThanOrEqual(k);
      const sorted = [...items].sort((x, y) => y.score - x.score).slice(0, k).map(x => x.text);
      expect(out).toEqual(sorted);
    }), { numRuns: 50 });
  });
});
