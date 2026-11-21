// Turns the per-file progress events of Transformers.js (and Kokoro, which uses it) into one Progress.
// Event shapes verified in @huggingface/transformers 4.3.2 types/utils/core.d.ts:
//   { status: "initiate" | "download" | "done", file }, { status: "progress", file, loaded, total, progress },
//   { status: "progress_total", loaded, total, progress }, { status: "ready" }.

import type { WorkerProgress } from "../workers/protocol.js";

type Event = { status?: string; file?: string; loaded?: number; total?: number };

export function fileProgress(emit: (p: WorkerProgress) => void) {
  const files = new Map<string, { loaded: number; total: number }>();
  let downloaded = false; // saw a partial file, so at least something came over the network
  let last = 0;

  const push = (stage: WorkerProgress["stage"], force = false) => {
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    const fraction = stage === "ready" ? 1 : total > 0 ? Math.min(1, loaded / total) : 0;
    const now = Date.now();
    if (!force && now - last < 100) return; // at most ten updates a second
    last = now;
    emit({ stage, fraction, loadedBytes: loaded, totalBytes: total, fromCache: !downloaded });
  };

  return {
    callback(e: unknown) {
      const ev = (e ?? {}) as Event;
      const file = ev.file ?? "";
      if (ev.status === "progress" && file && typeof ev.total === "number" && ev.total > 0) {
        const loaded = Math.max(0, Math.min(ev.total, ev.loaded ?? 0));
        if (loaded < ev.total) downloaded = true;
        files.set(file, { loaded, total: ev.total });
        push("downloading");
      } else if (ev.status === "done" && file) {
        const f = files.get(file);
        if (f) f.loaded = f.total;
        push("downloading", true);
      }
    },
    warming() {
      push("warming-up", true);
    },
    ready() {
      push("ready", true);
    },
  };
}
