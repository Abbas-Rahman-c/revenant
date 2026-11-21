// Every model ID in the part registry must appear in .kiro/steering/local-ai.md (the "never guess" rule).
import { readFileSync } from "node:fs";

const registry = readFileSync("circle/src/parts/registry.ts", "utf8");
const facts = readFileSync(".kiro/steering/local-ai.md", "utf8");
const ids = [...registry.matchAll(/(?:model|modelNoF16):\s*"([^"]+)"/g)].map((m) => m[1]).filter((id) => id !== "keywords");
const missing = ids.filter((id) => !facts.includes(id));
if (missing.length) {
  console.error("Model IDs used in registry.ts but not verified in local-ai.md:\n- " + missing.join("\n- "));
  process.exit(1);
}
console.log(`registry check passed (${ids.length} model IDs verified)`);
