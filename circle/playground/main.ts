// playground/main.ts - NOW uses real summon()!
// Task 04 Step 6: no more direct Kokoro / pipeline here!

import { summon } from "../src/summon";

const out = document.getElementById("out")!;
const log = (s: string) => { out.textContent += "\n" + s; };

document.getElementById("voiceBtn")!.addEventListener("click", async () => {
  out.textContent = "=== VOICE TEST - via summon() ===";
  try {
    const start = performance.now();
    const handle = await summon("voice", {
      onProgress: (p: any) => log(`[progress] ${p.message ?? JSON.stringify(p)}`),
    });
    const loadMs = Math.round(performance.now() - start);
    log(`summon(voice) ready in ${loadMs} ms`);

    const genStart = performance.now();
    const result = await handle.speak!("Hello, I am Revenant. This is the trailing text test");
    const genMs = Math.round(performance.now() - genStart);
    log(`Generated in ${genMs} ms`);
    log(`Audio: ${result.samples.length} samples, ${result.sampleRate} Hz`);
    const duration = result.samples.length / result.sampleRate;
    log(`Duration: ${duration.toFixed(2)} sec`);
    log(`Real-time factor: ${(genMs / 1000 / duration).toFixed(2)}x (must be < 1.0x to be usable)`);

    // Play it in the browser!
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(1, result.samples.length, result.sampleRate);
    buf.getChannelData(0).set(result.samples as Float32Array);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
    log("VOICE: PASS via summon() - you should HEAR me!");
    await handle.banish();
  } catch (e: any) {
    log("VOICE FAILED: " + (e?.message ?? JSON.stringify(e)));
    log("Error code: " + (e?.code ?? "unknown"));
    log("Fallback would be: Xenova/speecht5_tts");
  }
});

document.getElementById("memoryBtn")!.addEventListener("click", async () => {
  out.textContent = "=== MEMORY TEST - via summon() ===";
  try {
    const start = performance.now();
    const handle = await summon("memory", {
      onProgress: (p: any) => log(`[progress] ${p.message ?? JSON.stringify(p)}`),
    });
    const loadMs = Math.round(performance.now() - start);
    log(`summon(memory) ready in ${loadMs} ms`);

    // Remember 3 things via REAL IndexedDB memory!
    const id1 = await handle.remember("I love cats");
    const id2 = await handle.remember("I love dogs");
    const id3 = await handle.remember("Quantum physics is hard");
    log(`Remembered 3 items, ids: ${id1}, ${id2}, ${id3}`);

    // Recall "I love cats" - top hit should be cats or dogs, NOT physics!
    const hits = await handle.recall("I love cats", 3);
    log(`Recall "I love cats" top 3:`);
    hits.forEach((h: any, i: number) => log(`  ${i + 1}. [id ${h.id}] ${h.text}`));

    const top = hits[0]?.text ?? "";
    if (top.includes("cats") || top.includes("dogs")) {
      log("MEMORY: PASS via summon() - top hit is cats/dogs, not physics!");
    } else {
      log("MEMORY: WEIRD - top hit is physics, something is wrong!");
    }

    // Test forget!
    await handle.forget(id3);
    const after = await handle.recall("Quantum physics", 5);
    const stillThere = after.some((h: any) => h.id === id3);
    log(stillThere ? "FORGET: FAIL - physics still there!" : "FORGET: PASS - physics is gone!");

    await handle.banish();
  } catch (e: any) {
    log("MEMORY FAILED: " + (e?.message ?? JSON.stringify(e)));
    log("Error code: " + (e?.code ?? "unknown"));
    log("Fallback would be: Xenova/bge-small-en-v1.5");
  }
});