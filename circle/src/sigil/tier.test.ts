import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { chooseTier } from "./tier.js";

describe("chooseTier", () => {
  it("Strong gaming laptop -> full", () => {
    const r = chooseTier({ webgpu: true, memoryGB: 16, freeStorageMB: 10000, maxBufferMB: 2048 });
    expect(r.tier).toBe("full");
    expect(r.reasons).toEqual([]);
  });
  it("WebGPU, 8GB, 1.5GB storage -> small + LOW_STORAGE", () => {
    const r = chooseTier({ webgpu: true, memoryGB: 8, freeStorageMB: 1500, maxBufferMB: 2048 });
    expect(r.tier).toBe("small");
    expect(r.reasons).toEqual(["LOW_STORAGE"]);
  });
  it("Safari-like: memory unknown -> small + UNKNOWN_MEMORY", () => {
    const r = chooseTier({ webgpu: true, memoryGB: undefined, freeStorageMB: 10000, maxBufferMB: 2048 });
    expect(r.tier).toBe("small");
    expect(r.reasons).toEqual(["UNKNOWN_MEMORY"]);
  });
  it("Old phone: no WebGPU, 500MB -> tiny", () => {
    const r = chooseTier({ webgpu: false, memoryGB: 2, freeStorageMB: 500 });
    expect(r.tier).toBe("tiny");
    expect(r.reasons).toContain("NO_WEBGPU");
  });
  it("Storage almost full: 50MB -> none", () => {
    const r = chooseTier({ webgpu: true, memoryGB: 16, freeStorageMB: 50, maxBufferMB: 2048 });
    expect(r.tier).toBe("none");
  });
});

describe("chooseTier properties", () => {
  it("Property 1: More never hurts", () => {
    fc.assert(fc.property(
      fc.record({ webgpu: fc.boolean(), memoryGB: fc.integer({ min: 1, max: 16 }), freeStorageMB: fc.integer({ min: 0, max: 10000 }), maxBufferMB: fc.integer({ min: 0, max: 4096 }) }),
      (base) => {
        const rank = { none: 0, tiny: 1, small: 2, full: 3 } as const;
        const low = chooseTier({ ...base });
        const high = chooseTier({ ...base, memoryGB: base.memoryGB + 1, freeStorageMB: base.freeStorageMB + 100, maxBufferMB: base.maxBufferMB + 100 });
        return rank[high.tier] >= rank[low.tier];
      }
    ));
  });

  it("Property 2: No WebGPU = tiny or none", () => {
    fc.assert(fc.property(
      fc.record({ memoryGB: fc.option(fc.integer({ min: 1, max: 16 })), freeStorageMB: fc.option(fc.integer({ min: 0, max: 10000 })) }),
      ({ memoryGB, freeStorageMB }) => {
        const r = chooseTier({ webgpu: false, memoryGB: memoryGB ?? undefined, freeStorageMB: freeStorageMB ?? undefined });
        return r.tier === "tiny" || r.tier === "none";
      }
    ));
  });

  it("Property 3: Fits the device - tier storage need never exceeds free storage", () => {
    fc.assert(fc.property(
      fc.record({ webgpu: fc.boolean(), memoryGB: fc.option(fc.integer({ min: 1, max: 16 })), freeStorageMB: fc.integer({ min: 0, max: 10000 }), maxBufferMB: fc.option(fc.integer({ min: 0, max: 4096 })) }),
      (f) => {
        const r = chooseTier({ webgpu: f.webgpu, memoryGB: f.memoryGB ?? undefined, freeStorageMB: f.freeStorageMB, maxBufferMB: f.maxBufferMB ?? undefined });
        if (r.tier === "full") return f.freeStorageMB >= 4000;
        if (r.tier === "small") return f.freeStorageMB >= 1000;
        if (r.tier === "tiny") return f.freeStorageMB >= 200;
        return true;
      }
    ));
  });

  it("Property 4: Deterministic", () => {
    fc.assert(fc.property(
      fc.record({ webgpu: fc.boolean(), memoryGB: fc.option(fc.integer({ min: 1, max: 16 })), freeStorageMB: fc.option(fc.integer({ min: 0, max: 10000 })), maxBufferMB: fc.option(fc.integer({ min: 0, max: 4096 })) }),
      (f) => {
        const facts = { webgpu: f.webgpu, memoryGB: f.memoryGB ?? undefined, freeStorageMB: f.freeStorageMB ?? undefined, maxBufferMB: f.maxBufferMB ?? undefined };
        const a = chooseTier(facts);
        const b = chooseTier(facts);
        return a.tier === b.tier && JSON.stringify(a.reasons) === JSON.stringify(b.reasons);
      }
    ));
  });

  it("Property 5: Honest reasons - full has none, others have at least one", () => {
    fc.assert(fc.property(
      fc.record({ webgpu: fc.boolean(), memoryGB: fc.option(fc.integer({ min: 1, max: 16 })), freeStorageMB: fc.option(fc.integer({ min: 0, max: 10000 })), maxBufferMB: fc.option(fc.integer({ min: 0, max: 4096 })) }),
      (f) => {
        const facts = { webgpu: f.webgpu, memoryGB: f.memoryGB ?? undefined, freeStorageMB: f.freeStorageMB ?? undefined, maxBufferMB: f.maxBufferMB ?? undefined };
        const r = chooseTier(facts);
        if (r.tier === "full") return r.reasons.length === 0;
        return r.reasons.length >= 1;
      }
    ));
  });
});