// The main thread's side of one part's worker. Every request settles exactly once:
// with its result, its error, ABORTED, or a crash error if the worker dies.

import { circleError, isCircleError } from "../errors.js";
import type { CircleError, PartId, Tier } from "../types.js";
import type { FromWorker, ToWorker, WorkerLike, WorkerProgress } from "./protocol.js";

type Pending = {
  resolve(v: unknown): void;
  reject(e: CircleError): void;
  onChunk?: (v: unknown) => void;
  onProgress?: (p: WorkerProgress) => void;
  during: "load" | "run";
};

export type RequestOptions = {
  signal?: AbortSignal;
  onChunk?: (v: unknown) => void;
  onProgress?: (p: WorkerProgress) => void;
};

type Body = { type: "load"; tier: Tier } | { type: "run"; op: string; args: unknown };

export class Conn {
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private dead: CircleError | null = null;

  constructor(
    readonly part: PartId,
    private worker: WorkerLike,
  ) {
    worker.addEventListener("message", (e) => this.onMessage(e.data));
    worker.addEventListener("error", (e) => {
      const msg = (e as { message?: unknown })?.message;
      this.die(typeof msg === "string" && msg ? `The ${part} worker crashed: ${msg}` : `The ${part} worker crashed`);
    });
  }

  get alive(): boolean {
    return this.dead === null;
  }

  request(body: Body, opts: RequestOptions = {}): Promise<unknown> {
    const during = body.type === "load" ? "load" : "run";
    if (this.dead) {
      const d = this.dead;
      return Promise.reject(circleError(d.code === "ABORTED" ? "ABORTED" : during === "load" ? "MODEL_LOAD_FAILED" : "RUN_FAILED", this.part, d.message));
    }
    if (opts.signal?.aborted) return Promise.reject(circleError("ABORTED", this.part, "Aborted"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        try {
          this.worker.postMessage({ id, type: "abort" });
        } catch {
          /* worker already gone */
        }
        reject(circleError("ABORTED", this.part, "Aborted"));
      };
      const cleanup = () => opts.signal?.removeEventListener("abort", onAbort);
      this.pending.set(id, {
        resolve: (v) => {
          cleanup();
          resolve(v);
        },
        reject: (e) => {
          cleanup();
          reject(e);
        },
        onChunk: opts.onChunk,
        onProgress: opts.onProgress,
        during,
      });
      opts.signal?.addEventListener("abort", onAbort, { once: true });
      try {
        this.worker.postMessage({ id, ...body } as ToWorker);
      } catch (err) {
        this.pending.delete(id);
        cleanup();
        reject(circleError(during === "load" ? "MODEL_LOAD_FAILED" : "RUN_FAILED", this.part, String(err)));
      }
    });
  }

  /** Stops the worker. Anything still waiting is rejected with ABORTED. */
  terminate(): void {
    if (this.dead) return;
    try {
      this.worker.terminate();
    } catch {
      /* ignore */
    }
    this.failAll(circleError("ABORTED", this.part, "The part was banished"));
  }

  private die(message: string) {
    if (this.dead) return;
    try {
      this.worker.terminate();
    } catch {
      /* ignore */
    }
    this.failAll(circleError("RUN_FAILED", this.part, message));
  }

  private failAll(err: CircleError) {
    this.dead = err;
    const all = [...this.pending.values()];
    this.pending.clear();
    for (const p of all) {
      p.reject(err.code === "ABORTED" ? err : { ...err, code: p.during === "load" ? "MODEL_LOAD_FAILED" : "RUN_FAILED" });
    }
  }

  private onMessage(m: FromWorker) {
    const p = this.pending.get(m.id);
    if (!p) return; // already settled (aborted) or unknown: ignore
    switch (m.type) {
      case "progress":
        p.onProgress?.(m.progress);
        return;
      case "chunk":
        p.onChunk?.(m.value);
        return;
      case "result":
        this.pending.delete(m.id);
        p.resolve(m.value);
        return;
      case "error": {
        this.pending.delete(m.id);
        const e = { code: m.error.code, part: this.part, message: m.error.message };
        p.reject(isCircleError(e) ? e : circleError(p.during === "load" ? "MODEL_LOAD_FAILED" : "RUN_FAILED", this.part, String(m.error?.message)));
        return;
      }
    }
  }
}
