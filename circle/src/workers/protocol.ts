// The message protocol between the main thread and a part's worker.
// Every request has an id; every request gets exactly one terminal answer (result or error).

import type { ErrorCode, Progress, Tier } from "../types.js";

export type ToWorker =
  | { id: number; type: "load"; tier: Tier }
  | { id: number; type: "run"; op: string; args: unknown }
  /** Cancels the request with this id. Has no answer of its own. */
  | { id: number; type: "abort" };

export type WorkerProgress = Omit<Progress, "part">;

export type FromWorker =
  | { id: number; type: "progress"; progress: WorkerProgress }
  | { id: number; type: "chunk"; value: unknown }
  | { id: number; type: "result"; value: unknown }
  | { id: number; type: "error"; error: { code: ErrorCode; message: string } };

/** The parts of a Worker the runtime uses, so tests can pass a fake one. */
export type WorkerLike = {
  postMessage(message: ToWorker): void;
  addEventListener(type: "message", listener: (e: { data: FromWorker }) => void): void;
  addEventListener(type: "error", listener: (e: unknown) => void): void;
  terminate(): void;
};

/** The worker's side: where it receives requests and posts answers. */
export type WorkerScope = {
  postMessage(message: FromWorker, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (e: { data: ToWorker }) => void): void;
};
