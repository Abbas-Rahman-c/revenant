// Guards .kiro/steering/local-ai.md, the verified-facts file agents read on every request.
// Fails on blanks, on a heading swallowed by an unclosed code block, and on missing sections.
import { readFileSync } from "node:fs";

const text = readFileSync(".kiro/steering/local-ai.md", "utf8");
const bad = [];

if (/<placeholder>|_{3,}|TO FILL/.test(text)) bad.push("A blank is left (<placeholder>, ___ or TO FILL).");

let open = false;
text.split(/\r?\n/).forEach((line, i) => {
  if (/^\s*```/.test(line)) open = !open;
  else if (open && /^#{1,4} /.test(line)) bad.push(`Line ${i + 1}: heading inside an unclosed code block: ${line}`);
});
if (open) bad.push("The file ends inside an unclosed code block.");

for (const h of ["### Template", "Voice", "Memory", "Brain", "Ears", "## Verified browser APIs"]) {
  if (!text.includes(h)) bad.push(`Missing section: ${h}`);
}

if (bad.length) {
  console.error("local-ai.md check failed:\n- " + bad.join("\n- "));
  process.exit(1);
}
console.log("local-ai.md check passed");
