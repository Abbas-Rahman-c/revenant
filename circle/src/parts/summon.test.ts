import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { splitSentences } from "./voice.js";
import { topK } from "./cosine.js";
describe("voice + summon rules", () => {
  it("every request gets exactly one answer - ids are unique", () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 20 }), (ids) => {
      const seen = new Set(ids);
      const results = ids.map(id => ({ id, type: "result" as const }));
      expect(results.length).toBe(ids.length);
      expect(new Set(results.map(r => r.id)).size).toBe(seen.size);
    }), { numRuns: 30 });
  });
  it("fallback always gets lighter", () => {
    const order = ["full", "small", "tiny"];
    fc.assert(fc.property(fc.integer({ min: 0, max: 2 }), (start) => {
      const rest = order.slice(start + 1);
      for (let i = 1; i < rest.length; i++) {
        expect(order.indexOf(rest[i])).toBeGreaterThan(order.indexOf(rest[i - 1]));
      }
    }), { numRuns: 20 });
  });
  it("forget means forgotten - topK of empty is empty", () => {
    expect(topK([], 5)).toEqual([]);
  });
  it("splitSentences splits long text", () => {
    expect(splitSentences("Hello world. How are you? I am fine!")).toEqual(["Hello world.", "How are you?", "I am fine!"]);
  });
});
