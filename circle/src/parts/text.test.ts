import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { keywordScore, splitSentences } from "./text.js";
import { fileProgress } from "./progress.js";
import { toCircleError } from "../errors.js";

describe("splitSentences", () => {
  it("keeps the text after the last full stop", () => {
    expect(splitSentences("Hello. World")).toEqual(["Hello.", "World"]);
    expect(splitSentences("Hello world. How are you? I am fine!")).toEqual(["Hello world.", "How are you?", "I am fine!"]);
  });
  it("handles empty input and punctuation only", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("  ... !! ")).toEqual([]);
  });
  it("never loses a word", () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z]{1,8}[.!?]?$/), { maxLength: 20 }), (ws) => {
        const text = ws.join(" ");
        const back = splitSentences(text).join(" ").match(/[a-z]+/g) ?? [];
        expect(back).toEqual(text.match(/[a-z]+/g) ?? []);
      }),
    );
  });
});

describe("keywordScore", () => {
  it("scores shared words, ignoring case and filler words", () => {
    expect(keywordScore("I love storms", "Storms make me happy")).toBe(0.5);
    expect(keywordScore("the", "the cat")).toBe(0);
    expect(keywordScore("cats", "cats")).toBe(1);
  });
  it("is always between 0 and 1", () => {
    fc.assert(fc.property(fc.string(), fc.string(), (a, b) => {
      const s = keywordScore(a, b);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }));
  });
});

describe("fileProgress", () => {
  it("adds up bytes across files and knows when it downloaded", () => {
    const seen: { fraction: number; loadedBytes?: number; totalBytes?: number; fromCache: boolean; stage: string }[] = [];
    const p = fileProgress((x) => seen.push(x));
    p.callback({ status: "progress", file: "a", loaded: 50, total: 100 });
    p.callback({ status: "done", file: "a" });
    p.callback({ status: "progress", file: "b", loaded: 100, total: 100 });
    p.ready();
    const last = seen.at(-1)!;
    expect(last).toMatchObject({ stage: "ready", fraction: 1, loadedBytes: 200, totalBytes: 200, fromCache: false });
  });
  it("reports fromCache when every file arrived complete", () => {
    const seen: { fromCache: boolean }[] = [];
    const p = fileProgress((x) => seen.push(x));
    p.callback({ status: "progress", file: "a", loaded: 10, total: 10 });
    p.ready();
    expect(seen.at(-1)!.fromCache).toBe(true);
  });
});

describe("toCircleError", () => {
  it("maps known failures to specific codes", () => {
    expect(toCircleError(new Error("Failed to fetch"), "voice", "load").code).toBe("DOWNLOAD_FAILED");
    expect(toCircleError(new Error("Out of memory"), "brain", "run").code).toBe("OUT_OF_MEMORY");
    expect(toCircleError(new DOMException("x", "QuotaExceededError"), "memory", "run").code).toBe("LOW_STORAGE");
    expect(toCircleError(new DOMException("x", "AbortError"), "ears", "run").code).toBe("ABORTED");
    expect(toCircleError("weird", "ears", "run")).toEqual({ code: "RUN_FAILED", part: "ears", message: "weird" });
  });
});
