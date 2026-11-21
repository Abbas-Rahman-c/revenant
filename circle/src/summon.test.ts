import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { summon } from "./summon.js";
import { ERROR_CODES, isCircleError } from "./errors.js";
import { reply, type PartImpl } from "./workers/host.js";
import { Conn } from "./workers/conn.js";
import { fakeWorker, sleep, type FakeWorker } from "./test/fake-worker.js";
import { createMemoryImpl, type EmbedderLoader } from "./parts/memory.impl.js";
import { TIERS } from "./parts/registry.js";
import type { Tier } from "./types.js";

/** A part that loads after `loadMs`, and echoes after the delay it is given. */
function echoImpl(opts: { loadMs?: number; failTiers?: Tier[]; throwValue?: unknown; seen?: Tier[] } = {}): PartImpl {
  return {
    part: "ears",
    async load(tier, ctx) {
      opts.seen?.push(tier);
      ctx.progress({ stage: "downloading", fraction: 0.5, loadedBytes: 5, totalBytes: 10, fromCache: false });
      await sleep(opts.loadMs ?? 0);
      if (opts.failTiers?.includes(tier)) throw opts.throwValue ?? new Error(`no ${tier}`);
    },
    ops: {
      async transcribe(args) {
        const { samples } = args as { samples: Float32Array };
        const delay = samples[0] ?? 0;
        await sleep(delay);
        if (samples[1] === 1) throw "a plain string";
        return reply(`echo:${samples[2]}`);
      },
    },
  };
}

const ears = (impl: PartImpl, workers: FakeWorker[] = []) => ({
  tier: "small" as const,
  createWorker: () => {
    const w = fakeWorker(impl);
    workers.push(w);
    return w;
  },
});

describe("summon properties", () => {
  it("P1 every request gets exactly one answer, the one for its own id", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ delay: fc.integer({ min: 0, max: 4 }), fail: fc.boolean() }), { minLength: 1, maxLength: 12 }),
        async (calls) => {
          const h = await summon("ears", ears(echoImpl()));
          const settled = calls.map(() => 0);
          const results = await Promise.allSettled(
            calls.map((c, i) =>
              h.transcribe(new Float32Array([c.delay, c.fail ? 1 : 0, i])).finally(() => settled[i]++),
            ),
          );
          await sleep(10); // any late duplicate answer would show up now
          h.banish();
          results.forEach((r, i) => {
            expect(settled[i]).toBe(1);
            if (calls[i].fail) {
              expect(r.status).toBe("rejected");
              expect(isCircleError((r as PromiseRejectedResult).reason)).toBe(true);
            } else {
              expect(r).toEqual({ status: "fulfilled", value: `echo:${i}` });
            }
          });
        },
      ),
      { numRuns: 25 },
    );
  });

  it("P2 fallback only gets lighter, never repeats, and ends in a handle or a CircleError", async () => {
    await fc.assert(
      fc.asyncProperty(fc.subarray([...TIERS]), fc.constantFrom<Tier>(...TIERS), async (failTiers, start) => {
        const seen: Tier[] = [];
        const workers: FakeWorker[] = [];
        const impl = echoImpl({ failTiers, seen });
        try {
          const h = await summon("ears", { ...ears(impl, workers), tier: start });
          expect(failTiers).not.toContain(h.tier);
          h.banish();
        } catch (e) {
          expect(isCircleError(e)).toBe(true);
        }
        const order = seen.map((t) => TIERS.indexOf(t));
        for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
        expect(order[0] ?? TIERS.indexOf(start)).toBeGreaterThanOrEqual(TIERS.indexOf(start));
        // every worker of a failed tier was stopped
        workers.slice(0, -1).forEach((w) => expect(w.terminated).toBe(true));
      }),
      { numRuns: 40 },
    );
  });

  it("P3 whatever a part throws, the caller only ever sees a CircleError", async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (thrown) => {
        const impl = echoImpl({ failTiers: [...TIERS], throwValue: thrown });
        const err = await summon("ears", { ...ears(impl), tier: "full" }).then(
          () => null,
          (e: unknown) => e,
        );
        expect(isCircleError(err)).toBe(true);
        expect(ERROR_CODES).toContain((err as { code: string }).code);
        expect((err as { part: string }).part).toBe("ears");
      }),
      { numRuns: 60 },
    );
  });

  it("P4 abort at any moment ends in ABORTED or the result, and never kills a loaded part", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 12 }), fc.integer({ min: 0, max: 8 }), async (abortAt, loadMs) => {
        const workers: FakeWorker[] = [];
        const ac = new AbortController();
        setTimeout(() => ac.abort(), abortAt);
        const r = await summon("ears", { ...ears(echoImpl({ loadMs }), workers), signal: ac.signal }).then(
          (h) => ({ ok: true as const, h }),
          (e: unknown) => ({ ok: false as const, e }),
        );
        await sleep(15);
        if (r.ok) {
          // loaded before the abort: the abort must not have killed it
          expect(workers.at(-1)!.terminated).toBe(false);
          await expect(r.h.transcribe(new Float32Array([0, 0, 7]))).resolves.toBe("echo:7");
          // aborting one call rejects only that call
          const one = new AbortController();
          const p = r.h.transcribe(new Float32Array([5, 0, 1]), { signal: one.signal });
          one.abort();
          await expect(p).rejects.toMatchObject({ code: "ABORTED" });
          await expect(r.h.transcribe(new Float32Array([0, 0, 2]))).resolves.toBe("echo:2");
          r.h.banish();
        } else {
          expect(r.e).toMatchObject({ code: "ABORTED", part: "ears" });
          workers.forEach((w) => expect(w.terminated).toBe(true));
        }
      }),
      { numRuns: 40 },
    );
  });

  it("P5 forget means forgotten; before it, a remembered text is recalled first", async () => {
    // A deterministic embedder: bag of letters, normalized. Exact text always scores 1.
    const loader: EmbedderLoader = async () => async (text) => {
      const v = new Float32Array(26);
      for (const ch of text.toLowerCase()) {
        const i = ch.charCodeAt(0) - 97;
        if (i >= 0 && i < 26) v[i] += 1;
      }
      const n = Math.hypot(...v) || 1;
      return v.map((x) => x / n);
    };
    let db = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.stringMatching(/^[a-z]{3,12}$/), { minLength: 1, maxLength: 8 }),
        fc.boolean(),
        async (texts, tiny) => {
          const impl = createMemoryImpl({ loader, dbName: `mem-${db++}` });
          const h = await summon("memory", { tier: tiny ? "tiny" : "small", createWorker: () => fakeWorker(impl) });
          expect(h.keywordOnly).toBe(tiny);
          for (const t of texts) await h.remember(t);
          const pick = texts[texts.length - 1];
          const top = await h.recall(pick, 3);
          expect(top.length).toBeLessThanOrEqual(3);
          expect(top[0].text).toBe(pick);
          for (let i = 1; i < top.length; i++) expect(top[i - 1].score).toBeGreaterThanOrEqual(top[i].score);
          await h.forget(top[0].id);
          expect((await h.recall(pick, 10)).map((m) => m.text)).not.toContain(pick);
          await h.forget();
          expect(await h.recall(pick, 10)).toEqual([]);
          h.banish();
        },
      ),
      { numRuns: 20 },
    );
  });
});

describe("summon units", () => {
  it("reports progress with the part name", async () => {
    const seen: unknown[] = [];
    const h = await summon("ears", { ...ears(echoImpl()), onProgress: (p) => seen.push(p) });
    expect(seen[0]).toMatchObject({ part: "ears", stage: "checking" });
    expect(seen).toContainEqual({ part: "ears", stage: "downloading", fraction: 0.5, loadedBytes: 5, totalBytes: 10, fromCache: false });
    h.banish();
  });

  it("a crashed worker rejects what was waiting, and later calls, instead of hanging", async () => {
    const workers: FakeWorker[] = [];
    const h = await summon("ears", ears(echoImpl(), workers));
    const p = h.transcribe(new Float32Array([50, 0, 1]));
    workers[0].crash("lost");
    await expect(p).rejects.toMatchObject({ code: "RUN_FAILED", part: "ears" });
    await expect(h.transcribe(new Float32Array([0, 0, 1]))).rejects.toMatchObject({ code: "RUN_FAILED" });
  });

  it("a worker that crashes while loading fails that tier and tries the next", async () => {
    let n = 0;
    const h = await summon("ears", {
      tier: "full",
      createWorker: () => {
        const w = fakeWorker(echoImpl({ loadMs: 5 }));
        if (n++ === 0) w.crash("bad build");
        return w;
      },
    });
    expect(h.tier).toBe("small");
    h.banish();
  });

  it("a throwing Worker constructor becomes a CircleError", async () => {
    const e = await summon("memory", {
      tier: "small",
      createWorker: () => {
        throw new TypeError("Worker is not defined");
      },
    }).catch((x: unknown) => x);
    expect(isCircleError(e)).toBe(true);
  });

  it("parts that cannot run on a tier say why", async () => {
    await expect(summon("voice", { tier: "small", createWorker: () => fakeWorker(echoImpl()) })).rejects.toMatchObject({
      code: "NO_WEBGPU",
      part: "voice",
    });
    await expect(summon("brain", { tier: "tiny", createWorker: () => fakeWorker(echoImpl()) })).rejects.toMatchObject({
      code: "NO_WEBGPU",
    });
  });

  it("an already aborted signal rejects at once without starting a worker", async () => {
    let made = 0;
    const ac = new AbortController();
    ac.abort();
    await expect(
      summon("ears", { tier: "small", signal: ac.signal, createWorker: () => (made++, fakeWorker(echoImpl())) }),
    ).rejects.toMatchObject({ code: "ABORTED" });
    expect(made).toBe(0);
  });

  it("banish rejects calls in flight with ABORTED", async () => {
    const h = await summon("ears", ears(echoImpl()));
    const p = h.transcribe(new Float32Array([30, 0, 1]));
    h.banish();
    await expect(p).rejects.toMatchObject({ code: "ABORTED" });
  });

  it("Conn ignores answers for ids it does not know", async () => {
    const w = fakeWorker(echoImpl());
    const c = new Conn("ears", w);
    await c.request({ type: "load", tier: "small" });
    expect(c.alive).toBe(true);
  });
});

describe("summon and the device sigil", () => {
  it("a part that needs a bigger tier than the device allows gives the device's reason", async () => {
    const sigil = {
      facts: { webgpu: true, freeStorageMB: 700 },
      tier: "tiny" as const,
      reasons: ["LOW_STORAGE" as const],
    };
    await expect(summon("brain", { sigil, createWorker: () => fakeWorker(echoImpl()) })).rejects.toMatchObject({
      code: "LOW_STORAGE",
      part: "brain",
    });
  });
});
