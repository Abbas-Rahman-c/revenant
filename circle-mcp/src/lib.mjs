// Pure helpers for circle-mcp, kept apart from the server so they can be tested.

/** Splits markdown into sections by ### headings. */
export function sections(md) {
  const out = [];
  let cur = null;
  for (const line of md.split(/\r?\n/)) {
    const h = /^###\s+(.*)$/.exec(line);
    if (h) {
      cur = { title: h[1].trim(), body: "" };
      out.push(cur);
    } else if (cur) {
      cur.body += line + "\n";
    }
  }
  return out;
}

/** Model IDs written in a section: owner/name repos and WebLLM "-MLC" IDs. */
export function modelIdsIn(body) {
  const ids = new Set();
  for (const m of body.matchAll(/\b([\w.-]+\/[\w.-]+)\b/g)) {
    const id = m[1];
    if (/^(onnx-community|Xenova|mlc-ai|hexgrad|HuggingFaceTB|meta-llama|openai)\//.test(id)) ids.add(id);
  }
  for (const m of body.matchAll(/\b([\w.-]+-MLC)\b/g)) ids.add(m[1]);
  return [...ids];
}

/** Reads the registry source: part -> tier -> model. */
export function parseRegistry(src) {
  const out = {};
  const body = src.slice(src.indexOf("REGISTRY"));
  for (const part of ["brain", "ears", "voice", "memory"]) {
    const start = body.indexOf(`${part}: {`);
    if (start < 0) continue;
    let depth = 0;
    let end = start;
    for (let i = body.indexOf("{", start); i < body.length; i++) {
      if (body[i] === "{") depth++;
      if (body[i] === "}" && --depth === 0) {
        end = i;
        break;
      }
    }
    const block = body.slice(start, end);
    out[part] = {};
    for (const tier of ["full", "small", "tiny"]) {
      const m = new RegExp(`${tier}:\\s*{[^}]*model:\\s*"([^"]+)"`).exec(block);
      out[part][tier] = m ? m[1] : null;
    }
  }
  return out;
}

/** The useful parts of a Hugging Face /api/models response. */
export function summarizeCard(repo, d) {
  const files = (d.siblings ?? [])
    .filter((s) => /\.(onnx|onnx_data|bin|safetensors)$/.test(s.rfilename))
    .map((s) => ({ file: s.rfilename, MB: s.size ? +(s.size / 1048576).toFixed(1) : null }));
  return {
    repo,
    license: d.cardData?.license ?? d.tags?.find((t) => t.startsWith("license:"))?.slice(8) ?? null,
    task: d.pipeline_tag ?? null,
    library: d.library_name ?? null,
    downloads: d.downloads ?? null,
    files: files.slice(0, 30),
  };
}
