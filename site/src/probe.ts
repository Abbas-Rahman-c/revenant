/** What this browser can run, read from real browser APIs. Missing values stay undefined. */
export type Sigil = {
  webgpu: boolean;
  gpuName?: string;
  memoryGB?: number;
  cores?: number;
  storageGB?: number;
  tier: "tiny" | "small" | "full";
};

type GPUAdapterLike = { info?: { vendor?: string; architecture?: string; description?: string } };
type NavigatorWithGPU = Navigator & {
  gpu?: { requestAdapter(): Promise<GPUAdapterLike | null> };
  deviceMemory?: number;
};

/**
 * Probes the current browser. The tier rule is an early estimate for the landing page;
 * the real rule will live in circle/src/sigil once it exists.
 */
export async function probeDevice(): Promise<Sigil> {
  const nav = navigator as NavigatorWithGPU;

  let webgpu = false;
  let gpuName: string | undefined;
  try {
    const adapter = await nav.gpu?.requestAdapter();
    if (adapter) {
      webgpu = true;
      const info = adapter.info;
      gpuName = [info?.vendor, info?.architecture].filter(Boolean).join(" ") || info?.description || undefined;
    }
  } catch {
    webgpu = false;
  }

  let storageGB: number | undefined;
  try {
    const est = await navigator.storage?.estimate();
    if (est?.quota) storageGB = est.quota / 1024 ** 3;
  } catch {
    storageGB = undefined;
  }

  const memoryGB = nav.deviceMemory;
  const cores = navigator.hardwareConcurrency || undefined;

  // models must fit in storage as well as in memory
  const roomFor = (gb: number) => storageGB === undefined || storageGB >= gb;
  let tier: Sigil["tier"] = "tiny";
  if (webgpu && (memoryGB === undefined || memoryGB >= 4) && roomFor(1)) tier = "small";
  if (webgpu && memoryGB !== undefined && memoryGB >= 8 && roomFor(4)) tier = "full";

  return { webgpu, gpuName, memoryGB, cores, storageGB, tier };
}
