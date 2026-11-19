import type { BrowserEnv, DeviceFacts, Sigil } from "./types.js";
import { chooseTier } from "./tier.js";

function getRealEnv(): BrowserEnv {
  const nav = (globalThis as any).navigator;
  return {
    requestAdapter: nav?.gpu
      ? async () => {
          try { return await nav.gpu.requestAdapter(); } catch { return null; }
        }
      : undefined,
    deviceMemory: nav?.deviceMemory,
    hardwareConcurrency: nav?.hardwareConcurrency,
    storageEstimate: nav?.storage?.estimate
      ? async () => {
          try { return await nav.storage.estimate(); } catch { return {}; }
        }
      : undefined,
  };
}

export async function probeDevice(env?: BrowserEnv): Promise<Sigil> {
  try {
    const e = env ?? getRealEnv();
    let webgpu = false;
    let gpuName: string | undefined = undefined;
    let maxBufferMB: number | undefined = undefined;

    try {
      const adapter = e.requestAdapter ? await e.requestAdapter() : null;
      if (adapter) {
        const isFallback = (adapter as any).isFallbackAdapter === true;
        if (!isFallback) {
          webgpu = true;
          gpuName = (adapter as any).info?.description;
          const maxBuffer = (adapter as any).limits?.maxBufferSize;
          if (maxBuffer !== undefined && maxBuffer !== null) {
            maxBufferMB = Number(maxBuffer) / (1024 * 1024);
          }
        }
      }
    } catch { webgpu = false; }

    let memoryGB: number | undefined = undefined;
    let cores: number | undefined = undefined;
    try {
      if (typeof e.deviceMemory === "number") memoryGB = e.deviceMemory;
      if (typeof e.hardwareConcurrency === "number") cores = e.hardwareConcurrency;
    } catch {}

    let freeStorageMB: number | undefined = undefined;
    try {
      if (e.storageEstimate) {
        const est = await e.storageEstimate();
        if (typeof est.quota === "number" && typeof est.usage === "number") {
          freeStorageMB = (est.quota - est.usage) / (1024 * 1024);
        }
      }
    } catch {}

    const facts: DeviceFacts = { webgpu, gpuName, maxBufferMB, memoryGB, cores, freeStorageMB };
    const { tier, reasons } = chooseTier(facts);
    return { facts, tier, reasons };
  } catch {
    const facts: DeviceFacts = { webgpu: false };
    const { tier, reasons } = chooseTier(facts);
    return { facts, tier, reasons };
  }
}