import type { DeviceFacts, Tier, TierReason } from "./types.js";

export function chooseTier(facts: DeviceFacts): { tier: Tier; reasons: TierReason[] } {
  const memory = facts.memoryGB;
  const storage = facts.freeStorageMB;
  const buffer = facts.maxBufferMB;

  // 1. Try FULL: needs everything big
  if (
    facts.webgpu &&
    memory !== undefined && memory >= 8 &&
    storage !== undefined && storage >= 4000 &&
    buffer !== undefined && buffer >= 1024
  ) {
    return { tier: "full", reasons: [] };
  }

  // 2. Try SMALL: needs WebGPU + memory 4+ (or unknown) + storage 1000+
  const hasSmallMemory = memory === undefined || memory >= 4;
  const hasSmallStorage = storage !== undefined && storage >= 1000;

  if (facts.webgpu && hasSmallMemory && hasSmallStorage) {
    if (memory === undefined) return { tier: "small", reasons: ["UNKNOWN_MEMORY"] };
    if (storage !== undefined && storage < 4000) return { tier: "small", reasons: ["LOW_STORAGE"] };
    if (buffer !== undefined && buffer < 1024) return { tier: "small", reasons: ["SMALL_GPU_BUFFER"] };
    return { tier: "small", reasons: ["LOW_STORAGE"] };
  }

  // 3. Try TINY: needs only 200MB storage
  if (storage !== undefined && storage >= 200) {
    const reasons: TierReason[] = [];
    if (!facts.webgpu) reasons.push("NO_WEBGPU");
    if (memory !== undefined && memory < 4) reasons.push("LOW_MEMORY");
    if (storage < 1000) reasons.push("LOW_STORAGE");
    if (buffer !== undefined && buffer < 1024) reasons.push("SMALL_GPU_BUFFER");
    if (reasons.length === 0) reasons.push("NO_WEBGPU");
    return { tier: "tiny", reasons };
  }

  // 4. NONE: not even 200MB free
  const reasons: TierReason[] = [];
  if (!facts.webgpu) reasons.push("NO_WEBGPU");
  if (memory === undefined) reasons.push("UNKNOWN_MEMORY");
  else if (memory < 8) reasons.push("LOW_MEMORY");
  reasons.push("LOW_STORAGE");
  return { tier: "none", reasons };
}