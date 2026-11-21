// Voice part (runs in a worker): Kokoro text to speech.
// API verified in local-ai.md: KokoroTTS.from_pretrained(id, { dtype, device, progress_callback }),
// tts.generate(text, { voice }) -> { audio: Float32Array, sampling_rate }.

import { fileProgress } from "./progress.js";
import { entryFor } from "./registry.js";
import { reply, type PartImpl } from "../workers/host.js";

type Tts = { generate(text: string, o: { voice: string }): Promise<{ audio: Float32Array; sampling_rate: number }> };

export const VOICE = "am_michael"; // a low male voice suits the creature; "af_heart" is the one Task 02 measured

export function createVoiceImpl(opts: { voice?: string } = {}): PartImpl {
  let tts: Tts | null = null;
  const voice = opts.voice ?? VOICE;
  return {
    part: "voice",
    async load(tier, ctx) {
      const entry = entryFor("voice", tier);
      if (!entry) throw new Error(`No voice model for the ${tier} tier`);
      if (entry.device === "webgpu" && !(globalThis as { navigator?: { gpu?: unknown } }).navigator?.gpu) {
        throw new Error("WebGPU is not available");
      }
      const { KokoroTTS } = await import("kokoro-js");
      const p = fileProgress(ctx.progress);
      tts = (await KokoroTTS.from_pretrained(entry.model, {
        dtype: entry.dtype ?? "fp32",
        device: entry.device ?? "webgpu",
        progress_callback: p.callback,
      })) as unknown as Tts;
      p.warming();
      await tts.generate("Hm.", { voice });
      p.ready();
    },
    ops: {
      async speak(args, ctx) {
        const { text } = args as { text: unknown };
        if (typeof text !== "string" || !text.trim()) throw new Error("Nothing to say");
        const out = await tts!.generate(text, { voice });
        if (ctx.signal.aborted) throw new DOMException("Aborted", "AbortError");
        const samples = new Float32Array(out.audio); // own copy, safe to transfer
        return reply({ samples, sampleRate: out.sampling_rate }, [samples.buffer]);
      },
    },
  };
}
