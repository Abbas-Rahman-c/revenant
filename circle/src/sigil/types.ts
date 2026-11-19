export type Tier = "none" | "tiny" | "small" | "full";

export type DeviceFacts = {
  webgpu: boolean;
  gpuName?: string;
  maxBufferMB?: number;
  memoryGB?: number;
  cores?: number;
  freeStorageMB?: number;
};

export type TierReason =
  | "NO_WEBGPU"
  | "LOW_MEMORY"
  | "LOW_STORAGE"
  | "SMALL_GPU_BUFFER"
  | "UNKNOWN_MEMORY";

export type Sigil = {
  facts: DeviceFacts;
  tier: Tier;
  reasons: TierReason[];
};

export type BrowserEnv = {
  requestAdapter?: () => Promise<{
    isFallbackAdapter?: boolean;
    info?: { description?: string };
    limits?: { maxBufferSize?: number | bigint };
  } | null>;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  storageEstimate?: () => Promise<{ quota?: number; usage?: number }>;
};