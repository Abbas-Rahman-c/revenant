import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { probeDevice } from "./probe.js";
import { chooseTier } from "./tier.js";

describe("probeDevice", () => {
  it("Software fallback = NO WebGPU", async () => {
    const s = await probeDevice({
      requestAdapter: async () => ({ isFallbackAdapter: true, limits: { maxBufferSize: 999999999 } }),
      deviceMemory: 16,
      hardwareConcurrency: 8,
      storageEstimate: async () => ({ quota: 10000 * 1024 * 1024, usage: 0 }),
    });
    expect(s.facts.webgpu).toBe(false);
  });
  it("Every API throws -> still returns", async () => {
    const s = await probeDevice({
      requestAdapter: async () => { throw new Error("boom"); },
      storageEstimate: async () => { throw new Error("boom"); },
    });
    expect(["none", "tiny", "small", "full"]).toContain(s.tier);
  });
  it("Property: No WebGPU = tiny or none", () => {
    fc.assert(fc.property(fc.record({ memoryGB: fc.option(fc.integer({ min: 1, max: 16 })), freeStorageMB: fc.option(fc.integer({ min: 0, max: 10000 })) }), ({ memoryGB, freeStorageMB }) => {
      const r = chooseTier({ webgpu: false, memoryGB: memoryGB ?? undefined, freeStorageMB: freeStorageMB ?? undefined });
      return r.tier === "tiny" || r.tier === "none";
    }));
  });
  it("Property: Tier fits storage", () => {
    fc.assert(fc.property(fc.record({ webgpu: fc.boolean(), memoryGB: fc.option(fc.integer({ min: 1, max: 16 })), freeStorageMB: fc.integer({ min: 0, max: 10000 }), maxBufferMB: fc.option(fc.integer({ min: 0, max: 4096 })) }), (f) => {
      const r = chooseTier({ webgpu: f.webgpu, memoryGB: f.memoryGB ?? undefined, freeStorageMB: f.freeStorageMB, maxBufferMB: f.maxBufferMB ?? undefined });
      if (r.tier === "full") return f.freeStorageMB >= 4000;
      if (r.tier === "small") return f.freeStorageMB >= 1000;
      if (r.tier === "tiny") return f.freeStorageMB >= 200;
      return true;
    }));
  });
  it("Property: Deterministic + Honest reasons", () => {
    fc.assert(fc.property(fc.record({ webgpu: fc.boolean(), memoryGB: fc.option(fc.integer({ min: 1, max: 16 })), freeStorageMB: fc.option(fc.integer({ min: 0, max: 10000 })), maxBufferMB: fc.option(fc.integer({ min: 0, max: 4096 })) }), (f) => {
      const facts = { webgpu: f.webgpu, memoryGB: f.memoryGB ?? undefined, freeStorageMB: f.freeStorageMB ?? undefined, maxBufferMB: f.maxBufferMB ?? undefined };
      const a = chooseTier(facts); const b = chooseTier(facts);
      if (a.tier !== b.tier) return false;
      if (a.tier === "full") return a.reasons.length === 0;
      return a.reasons.length >= 1;
    }));
  });
  it("Property: More never hurts", () => {
    fc.assert(fc.property(fc.record({ webgpu: fc.boolean(), memoryGB: fc.integer({ min: 1, max: 16 }), freeStorageMB: fc.integer({ min: 0, max: 10000 }), maxBufferMB: fc.integer({ min: 0, max: 4096 }) }), (base) => {
      const rank = { none: 0, tiny: 1, small: 2, full: 3 } as const;
      const low = chooseTier({ ...base });
      const high = chooseTier({ ...base, memoryGB: base.memoryGB + 1, freeStorageMB: base.freeStorageMB + 100, maxBufferMB: base.maxBufferMB + 100 });
      return rank[high.tier] >= rank[low.tier];
    }));
  });
});
