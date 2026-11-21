/** Splits text into sentences. Keeps text after the last full stop, and never returns empty strings. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[^.!?\n]+(?:[.!?]+["')\]]*|\n|$)/g;
  for (const m of text.matchAll(re)) {
    const s = m[0].trim();
    if (s && /[\p{L}\p{N}]/u.test(s)) out.push(s);
  }
  return out;
}

const STOP = new Set([
  "a", "an", "the", "i", "you", "me", "my", "your", "is", "am", "are", "was", "were", "be", "to", "of", "and",
  "or", "in", "on", "at", "it", "that", "this", "do", "did", "what", "for", "with", "so", "but",
]);

export function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []).filter((w) => !STOP.has(w));
}

/** Keyword similarity for the tiny tier: the share of query words that appear in the text (0 to 1). */
export function keywordScore(query: string, text: string): number {
  const q = new Set(words(query));
  if (q.size === 0) return 0;
  const t = new Set(words(text));
  let hit = 0;
  for (const w of q) if (t.has(w)) hit++;
  return hit / q.size;
}
