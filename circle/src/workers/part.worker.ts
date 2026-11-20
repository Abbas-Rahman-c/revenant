/// <reference lib="webworker" />
import { KokoroTTS } from "kokoro-js";
import { pipeline } from "@huggingface/transformers";
let tts: any = null;
let extractor: any = null;
self.onmessage = async (e: MessageEvent) => {
  const msg = e.data as any;
  try {
    if (msg.type === "load" && msg.part === "voice") {
      tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32", device: "webgpu" });
      (self as any).postMessage({ id: msg.id, type: "result", payload: { ready: true } });
    }
    if (msg.type === "load" && msg.part === "memory") {
      extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      (self as any).postMessage({ id: msg.id, type: "result", payload: { ready: true } });
    }
    if (msg.type === "run" && msg.part === "voice") {
      const audio = await tts.generate(msg.payload.text, { voice: "af_heart" });
      (self as any).postMessage({ id: msg.id, type: "result", payload: { samples: audio.audio, sampleRate: audio.sampling_rate } }, [audio.audio.buffer]);
    }
    if (msg.type === "run" && msg.part === "memory") {
      const out = await extractor(msg.payload.text, { pooling: "mean", normalize: true });
      (self as any).postMessage({ id: msg.id, type: "result", payload: { vector: out.data } }, [out.data.buffer]);
    }
  } catch (err: any) {
    (self as any).postMessage({ id: msg.id, type: "error", payload: { code: "MODEL_LOAD_FAILED", part: msg.part, message: String(err?.message ?? err) } });
  }
};
