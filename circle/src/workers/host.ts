// Runs inside a worker. Turns protocol messages into calls on a part implementation,
// and guarantees exactly one terminal answer per request id.

import { toCircleError } from "../errors.js";
import type { PartId, Tier } from "../types.js";
import type { FromWorker, ToWorker, WorkerProgress, WorkerScope } from "./protocol.js";

export type Reply = { value: unknown; transfer?: Transferable[] };

export type OpContext = {
  signal: AbortSignal;
  /** Streams a partial value back (for example one token, or one sentence of audio). */
  chunk(value: unknown, transfer?: Transferable[]): void;
};

export type LoadContext = {
  signal: AbortSignal;
  progress(p: WorkerProgress): void;
};

export type PartImpl = {
  part: PartId;
  load(tier: Tier, ctx: LoadContext): Promise<void>;
  ops: Record<string, (args: unknown, ctx: OpContext) => Promise<Reply>>;
};

export function reply(value: unknown, transfer?: Transferable[]): Reply {
  return { value, transfer };
}

export function serve(impl: PartImpl, scope: WorkerScope): void {
  const inflight = new Map<number, AbortController>();
  let loaded: Promise<void> | null = null;

  const post = (m: FromWorker, transfer?: Transferable[]) => {
    try {
      scope.postMessage(m, transfer);
    } catch {
      // A transfer can fail if a buffer was already detached; send a copy instead.
      scope.postMessage(m);
    }
  };

  const finish = (id: number, m: FromWorker, transfer?: Transferable[]) => {
    if (!inflight.has(id)) return; // already answered (aborted): stay silent
    inflight.delete(id);
    post(m, transfer);
  };

  async function handle(msg: ToWorker) {
    if (msg.type === "abort") {
      const c = inflight.get(msg.id);
      if (c) {
        c.abort();
        finish(msg.id, { id: msg.id, type: "error", error: { code: "ABORTED", message: "Aborted" } });
      }
      return;
    }
    if (inflight.has(msg.id)) return; // duplicate id: ignore, the first one answers
    const controller = new AbortController();
    inflight.set(msg.id, controller);
    const during = msg.type === "load" ? "load" : "run";
    try {
      if (msg.type === "load") {
        if (!loaded) {
          loaded = impl.load(msg.tier, {
            signal: controller.signal,
            progress: (p) => {
              if (inflight.has(msg.id)) post({ id: msg.id, type: "progress", progress: p });
            },
          });
          loaded.catch(() => (loaded = null)); // a failed load can be retried
        }
        await loaded;
        finish(msg.id, { id: msg.id, type: "result", value: true });
        return;
      }
      if (!loaded) throw new Error("The model is not loaded");
      await loaded;
      const op = impl.ops[msg.op];
      if (!op) throw new Error(`Unknown operation: ${msg.op}`);
      const r = await op(msg.args, {
        signal: controller.signal,
        chunk: (value, transfer) => {
          if (inflight.has(msg.id)) post({ id: msg.id, type: "chunk", value }, transfer);
        },
      });
      finish(msg.id, { id: msg.id, type: "result", value: r.value }, r.transfer);
    } catch (err) {
      const e = toCircleError(controller.signal.aborted ? new DOMException("Aborted", "AbortError") : err, impl.part, during);
      finish(msg.id, { id: msg.id, type: "error", error: { code: e.code, message: e.message } });
    }
  }

  scope.addEventListener("message", (e) => {
    void handle(e.data);
  });
}
