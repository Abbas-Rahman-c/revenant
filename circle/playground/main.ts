import { KokoroTTS } from "kokoro-js";
import { pipeline } from "@huggingface/transformers";

const out = document.getElementById("out")!;
const log = (s: string) => { out.textContent += "\n" + s; };

document.getElementById("voiceBtn")!.addEventListener("click", async () => {
  out.textContent = "=== VOICE TEST ===";
  try {
    const start = performance.now();
    const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8",
      device: "wasm",
    });
    const loadMs = Math.round(performance.now() - start);
    log(`Model loaded in ${loadMs} ms`);

    const genStart = performance.now();
    const audio = await tts.generate("Hello, I am Revenant.", { voice: "af_heart" });
    const genMs = Math.round(performance.now() - genStart);
    log(`Generated in ${genMs} ms`);
    log(`Audio: ${audio.audio.length} samples, ${audio.sampling_rate} Hz`);
    log(`Duration: ${(audio.audio.length / audio.sampling_rate).toFixed(2)} sec`);
    log("VOICE: PASS - copy these numbers!");
    audio.save("revenant-test.wav");
  } catch (e: any) {
    log("VOICE FAILED: " + (e?.message ?? e));
    log("Fallback would be: Xenova/speecht5_tts");
  }
});

document.getElementById("memoryBtn")!.addEventListener("click", async () => {
  out.textContent = "=== MEMORY TEST ===";
  try {
    const start = performance.now();
    const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    const loadMs = Math.round(performance.now() - start);
    log(`Model loaded in ${loadMs} ms`);

    const a = await extractor("I love cats", { pooling: "mean", normalize: true });
    const b = await extractor("I love dogs", { pooling: "mean", normalize: true });
    const c = await extractor("Quantum physics is hard", { pooling: "mean", normalize: true });

    const cos = (x: any, y: any) => {
      const xa = Array.from(x.data as Float32Array);
      const ya = Array.from(y.data as Float32Array);
      let dot = 0;
      for (let i = 0; i < xa.length; i++) dot += xa[i] * ya[i];
      return dot;
    };

    log(`Embedding size: ${(a.data as Float32Array).length} dims`);
    log(`cats vs dogs similarity: ${cos(a, b).toFixed(3)} (should be HIGH)`);
    log(`cats vs physics similarity: ${cos(a, c).toFixed(3)} (should be LOW)`);
    log("MEMORY: PASS - copy these numbers!");
  } catch (e: any) {
    log("MEMORY FAILED: " + (e?.message ?? e));
    log("Fallback would be: bge-small-en-v1.5");
  }
});