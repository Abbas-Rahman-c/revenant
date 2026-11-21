// Ears part (runs in a worker): Whisper speech to text through Transformers.js.
// pipeline("automatic-speech-recognition", model, { device, dtype, progress_callback }); input: 16 kHz mono Float32Array.

import { fileProgress } from "./progress.js";
import { entryFor } from "./registry.js";
import { reply, type PartImpl } from "../workers/host.js";

type Asr = (audio: Float32Array) => Promise<{ text: string } | { text: string }[]>;

export function createEarsImpl(): PartImpl {
  let asr: Asr | null = null;
  return {
    part: "ears",
    async load(tier, ctx) {
      const entry = entryFor("ears", tier);
      if (!entry) throw new Error(`No ears model for the ${tier} tier`);
      const { pipeline } = await import("@huggingface/transformers");
      const p = fileProgress(ctx.progress);
      asr = (await pipeline("automatic-speech-recognition", entry.model, {
        device: entry.device,
        dtype: entry.dtype,
        progress_callback: p.callback,
      })) as unknown as Asr;
      p.warming();
      await asr(new Float32Array(16000)); // one second of silence compiles the graph
      p.ready();
    },
    ops: {
      async transcribe(args, ctx) {
        const { samples } = args as { samples: unknown };
        if (!(samples instanceof Float32Array)) throw new Error("samples must be a Float32Array");
        if (samples.length < 1600) return reply(""); // under 0.1 s: nothing said
        const out = await asr!(samples);
        if (ctx.signal.aborted) throw new DOMException("Aborted", "AbortError");
        const text = (Array.isArray(out) ? out.map((o) => o.text).join(" ") : out.text).trim();
        // Whisper writes these for silence or noise.
        return reply(/^\[?(blank_audio|silence|music|inaudible)\]?$|^\(.*\)$/i.test(text) ? "" : text);
      },
    },
  };
}
