import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { modelIdsIn, parseRegistry, sections, summarizeCard } from "../src/lib.mjs";

const facts = readFileSync(new URL("../../.kiro/steering/local-ai.md", import.meta.url), "utf8");
const registry = readFileSync(new URL("../../circle/src/parts/registry.ts", import.meta.url), "utf8");

test("every model the registry uses is in a verified local-ai.md entry", () => {
  const verified = new Set(sections(facts).filter((s) => /VERIFIED/.test(s.title)).flatMap((s) => modelIdsIn(s.body)));
  const reg = parseRegistry(registry);
  for (const [part, tiers] of Object.entries(reg)) {
    for (const [tier, id] of Object.entries(tiers)) {
      if (id && id !== "keywords") assert.ok(verified.has(id), `${part}/${tier}: ${id} is not verified`);
    }
  }
});

test("parseRegistry reads part and tier", () => {
  const reg = parseRegistry(registry);
  assert.equal(reg.voice.small, null);
  assert.equal(reg.ears.tiny, "onnx-community/whisper-tiny.en");
  assert.match(reg.brain.full, /-MLC$/);
});

test("summarizeCard keeps license and file sizes", () => {
  const s = summarizeCard("a/b", {
    cardData: { license: "apache-2.0" },
    pipeline_tag: "text-to-speech",
    siblings: [{ rfilename: "onnx/model.onnx", size: 2 * 1048576 }, { rfilename: "README.md" }],
  });
  assert.equal(s.license, "apache-2.0");
  assert.deepEqual(s.files, [{ file: "onnx/model.onnx", MB: 2 }]);
});
