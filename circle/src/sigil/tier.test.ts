import { describe, it, expect } from "vitest";
import { chooseTier } from "./tier.js";

describe("chooseTier", () => {
  it("Strong gaming laptop -> full", () => {
    const r = chooseTier({ webgpu: true, memoryGB: 16, freeStorageMB: 10000, maxBufferMB: 2048 });
    expect(r.tier).toBe("full");
    expect(r.reasons).toEqual([]);
  });
  it("WebGPU, 8GB, 1.5GB storage -> small", () => {
    const r = chooseTier({ webgpu: true, memoryGB: 8, freeStorageMB: 1500, maxBufferMB: 2048 });
    expect(r.tier).toBe("small");
    expect(r.reasons).toEqual(["LOW_STORAGE"]);
  });
  it("Safari-like: memory unknown -> small", () => {
    const r = chooseTier({ webgpu: true, memoryGB: undefined, freeStorageMB: 10000, maxBufferMB: 2048 });
    expect(r.tier).toBe("small");
    expect(r.reasons).toEqual(["UNKNOWN_MEMORY"]);
  });
  it("Old phone -> tiny", () => {
    const r = chooseTier({ webgpu: false, memoryGB: 2, freeStorageMB: 500 });
    expect(r.tier).toBe("tiny");
    expect(r.reasons).toContain("NO_WEBGPU");
  });
  it("Storage almost full -> none", () => {
    const r = chooseTier({ webgpu: true, memoryGB: 16, freeStorageMB: 50, maxBufferMB: 2048 });
    expect(r.tier).toBe("none");
  });
});
