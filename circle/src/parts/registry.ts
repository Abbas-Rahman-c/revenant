// Which model each part uses on each tier. Every ID here is recorded in .kiro/steering/local-ai.md.
// A tier with no entry means the part cannot run there; summon() then tries the next lighter tier.

import type { ErrorCode, PartId, Tier } from "../types.js";

export const TIERS: readonly Tier[] = ["full", "small", "tiny"]; // heaviest first

export type Entry = {
  model: string;
  /** Transformers.js / Kokoro options. */
  device?: "webgpu" | "wasm";
  dtype?: "fp32" | "fp16" | "q8" | "q4";
  /** WebLLM: the model to use when the GPU lacks the shader-f16 feature. */
  modelNoF16?: string;
};

type Row = Partial<Record<Tier, Entry>> & { unsupported?: { code: ErrorCode; message: string } };

export const REGISTRY: Record<PartId, Row> = {
  brain: {
    full: { model: "Llama-3.2-1B-Instruct-q4f16_1-MLC", modelNoF16: "Llama-3.2-1B-Instruct-q4f32_1-MLC" },
    small: { model: "SmolLM2-360M-Instruct-q4f16_1-MLC", modelNoF16: "SmolLM2-360M-Instruct-q4f32_1-MLC" },
    unsupported: { code: "NO_WEBGPU", message: "The brain needs WebGPU." },
  },
  ears: {
    full: { model: "onnx-community/whisper-tiny.en", device: "webgpu", dtype: "fp32" },
    small: { model: "onnx-community/whisper-tiny.en", device: "wasm", dtype: "q8" },
    tiny: { model: "onnx-community/whisper-tiny.en", device: "wasm", dtype: "q8" },
  },
  voice: {
    // Measured: Kokoro on WebAssembly is ~5x slower than real time, too slow to talk.
    full: { model: "onnx-community/Kokoro-82M-v1.0-ONNX", device: "webgpu", dtype: "fp32" },
    unsupported: { code: "NO_WEBGPU", message: "The voice needs WebGPU to speak in real time." },
  },
  memory: {
    full: { model: "Xenova/all-MiniLM-L6-v2" },
    small: { model: "Xenova/all-MiniLM-L6-v2" },
    // tiny: keyword memory, no model. The entry exists so the tier is supported.
    tiny: { model: "keywords" },
  },
};

export function entryFor(part: PartId, tier: Tier): Entry | undefined {
  return REGISTRY[part][tier];
}

/** The tiers to try, starting at `start` and getting strictly lighter. */
export function tiersFrom(start: Tier): Tier[] {
  return TIERS.slice(TIERS.indexOf(start));
}
