import { readFileSync } from "node:fs";
const text = readFileSync(".kiro/steering/local-ai.md", "utf8");
let bad = [];
if (text.includes("<placeholder>") || text.includes("___") || text.includes("TO FILL")) bad.push("Blanks left: ___ / <placeholder> / TO FILL found!");
const ticks = (text.match(/```/g) || []).length;
if (ticks % 2 !== 0) bad.push("Unclosed code block: odd number of ``` marks!");
for (const h of ["Template", "Voice", "Memory", "Verified browser APIs"]) {
  if (!text.includes(h)) bad.push("Missing heading: " + h);
}
if (bad.length) { console.error("local-ai.md CHECK FAILED:"); for (const b of bad) console.error("- " + b); process.exit(1); }
console.log("local-ai.md CHECK PASSED!");
