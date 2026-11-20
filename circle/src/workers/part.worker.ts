/// <reference lib="webworker" />
import { KokoroTTS } from "kokoro-js";
import { pipeline } from "@huggingface/transformers";
import { remember as realRemember, recall as realRecall, forget as realForget } from "../parts/memory";

let tts: any = null;
let extractor: any = null;

function post(id: number, type: string, payload: unknown) {
  (self as any).postMessage({ id, type, payload });
}

function progress(message: string, percent?: number) {
  (self as any).postMessage({ type: "progress", payload: { message, percent, phase: "loading" } });
}

async function ensureVoice() {
  if (!tts) {
    progress("Loading Kokoro voice...", 10);
    tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "fp32",
      device: "webgpu",
      
      progress_callback: (p: any) => progress("Loading Kokoro: " + String(p?.status ?? p), p?.progress),
    });
    progress("Kokoro ready!", 100);
  }
  return tts;
}

async function ensureMemory() {
  if (!extractor) {
    progress("Loading MiniLM memory...", 10);
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      
      progress_callback: (p: any) => progress("Loading MiniLM: " + String(p?.status ?? p), p?.progress),
    });
    progress("MiniLM ready!", 100);
  }
  return extractor;
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data as any;
  try {
    // NEW summon.ts sends "init", OLD code sent "load" - support BOTH!
    if ((msg.type === "init" || msg.type === "load") && msg.part === "voice") {
      await ensureVoice();
      post(msg.id ?? 1, "result", { ready: true });
      return;
    }
    if ((msg.type === "init" || msg.type === "load") && msg.part === "memory") {
      await ensureMemory();
      // Warm up the real memory DB too (creates IndexedDB store)
      await realRecall("__warmup__", 1).catch(() => []);
      post(msg.id ?? 1, "result", { ready: true });
      return;
    }

    if (msg.type === "run" && msg.part === "voice") {
      const op = msg.payload?.op ?? "speak";
      if (op === "speak") {
        const voice = await ensureVoice();
        const audio = await voice.generate(msg.payload.text, { voice: "af_heart" });
        post(msg.id, "result", { samples: Array.from(audio.audio as Float32Array), sampleRate: audio.sampling_rate });
        return;
      }
    }

    if (msg.type === "run" && msg.part === "memory") {
      const op = msg.payload?.op;
      // OLD behaviour: no op = just embed, return vector (for old tests)
      if (!op) {
        const ex = await ensureMemory();
        const out = await ex(msg.payload.text, { pooling: "mean", normalize: true });
        post(msg.id, "result", { vector: Array.from(out.data as Float32Array) });
        return;
      }
      if (op === "remember") {
        const id = await realRemember(msg.payload.text);
        post(msg.id, "result", { id });
        return;
      }
      if (op === "recall") {
        const items = await realRecall(msg.payload.text, msg.payload.limit ?? 5);
        post(msg.id, "result", { items });
        return;
      }
      if (op === "forget") {
        await realForget(msg.payload.id);
        post(msg.id, "result", {});
        return;
      }
    }

    // Unknown op - tell summon, don't hang!
    post(msg.id, "error", { code: "MODEL_LOAD_FAILED", part: msg.part, message: "Unknown op: " + String(msg.payload?.op) });
  } catch (err: any) {
    post(msg.id, "error", { code: "MODEL_LOAD_FAILED", part: msg.part, message: String(err?.message ?? err) });
  }
};