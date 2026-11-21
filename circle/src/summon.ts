// summon(): load one part of the creature and return its handle.
// Picks the tier from the device sigil, retries once per lighter tier, and only ever rejects with a CircleError.

import { circleError, toCircleError } from "./errors.js";
import { brainHandle, earsHandle, memoryHandle, voiceHandle } from "./handles.js";
import { entryFor, REGISTRY, tiersFrom } from "./parts/registry.js";
import { probeDevice } from "./sigil/probe.js";
import { Conn } from "./workers/conn.js";
import type { WorkerLike } from "./workers/protocol.js";
import type { Sigil } from "./sigil/types.js";
import type { CircleError, HandleFor, PartId, Progress, Tier } from "./types.js";

export type SummonOptions = {
  /** "auto" (the default) reads the device sigil. */
  tier?: Tier | "auto";
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
  /** Called once per tier attempted; useful for showing "trying a lighter model". */
  onAttempt?: (tier: Tier) => void;
  /** For tests: make a worker for a part. Defaults to the real Web Worker. */
  createWorker?: (part: PartId) => WorkerLike;
  /** Skip probing when the caller already has a sigil. */
  sigil?: Sigil;
};

export function defaultWorker(part: PartId): WorkerLike {
  // Literal URLs and options, so bundlers (Vite) can find and bundle each worker.
  switch (part) {
    case "brain":
      return new Worker(new URL("./workers/brain.worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike;
    case "ears":
      return new Worker(new URL("./workers/ears.worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike;
    case "voice":
      return new Worker(new URL("./workers/voice.worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike;
    case "memory":
      return new Worker(new URL("./workers/memory.worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike;
  }
}

async function startTier(opts: SummonOptions): Promise<{ tier: Tier; limit?: { code: CircleError["code"]; message: string } }> {
  if (opts.tier && opts.tier !== "auto") return { tier: opts.tier };
  const sigil = opts.sigil ?? (await probeDevice());
  const tier = sigil.tier === "none" ? "tiny" : sigil.tier;
  // Why the device was held to this tier, so a part that needs more can say the real reason.
  const r = sigil.reasons;
  const limit = r.includes("NO_WEBGPU")
    ? { code: "NO_WEBGPU" as const, message: "This browser does not offer WebGPU." }
    : r.includes("LOW_STORAGE")
      ? { code: "LOW_STORAGE" as const, message: "Not enough free storage for a larger model." }
      : r.includes("LOW_MEMORY") || r.includes("SMALL_GPU_BUFFER")
        ? { code: "OUT_OF_MEMORY" as const, message: "Not enough memory for a larger model." }
        : undefined;
  return { tier, limit };
}

export async function summon<P extends PartId>(part: P, opts: SummonOptions = {}): Promise<HandleFor<P>> {
  const aborted = () => circleError("ABORTED", part, "Aborted");
  if (opts.signal?.aborted) throw aborted();

  let start: Tier;
  let limit: { code: CircleError["code"]; message: string } | undefined;
  try {
    ({ tier: start, limit } = await startTier(opts));
  } catch {
    start = "tiny"; // probing failed: be conservative
  }

  let last: CircleError | null = null;
  for (const tier of tiersFrom(start)) {
    if (opts.signal?.aborted) throw aborted();
    if (!entryFor(part, tier)) {
      const u = REGISTRY[part].unsupported;
      last = circleError(u?.code ?? "MODEL_LOAD_FAILED", part, u?.message ?? `The ${part} cannot run on the ${tier} tier.`);
      continue;
    }
    opts.onAttempt?.(tier);
    let conn: Conn | null = null;
    try {
      conn = new Conn(part, (opts.createWorker ?? defaultWorker)(part));
      opts.onProgress?.({ part, stage: "checking", fraction: 0, fromCache: false });
      await conn.request(
        { type: "load", tier },
        { signal: opts.signal, onProgress: (p) => opts.onProgress?.({ ...p, part }) },
      );
      return (await makeHandle(part, conn, tier)) as HandleFor<P>;
    } catch (e) {
      conn?.terminate();
      const err = toCircleError(e, part, "load");
      if (err.code === "ABORTED" || opts.signal?.aborted) throw aborted();
      last = err;
    }
  }
  // Nothing ran. If no tier was even attempted and the device was held back, give the device's reason.
  if (limit && last && tiersFrom(start).every((t) => !entryFor(part, t))) throw circleError(limit.code, part, limit.message);
  throw last ?? circleError("MODEL_LOAD_FAILED", part, `The ${part} could not be loaded.`);
}

async function makeHandle(part: PartId, conn: Conn, tier: Tier) {
  switch (part) {
    case "brain": {
      const model = String(await conn.request({ type: "run", op: "model", args: null }));
      return brainHandle(conn, tier, model);
    }
    case "ears":
      return earsHandle(conn, tier);
    case "voice":
      return voiceHandle(conn, tier);
    case "memory":
      return memoryHandle(conn, tier);
  }
}
