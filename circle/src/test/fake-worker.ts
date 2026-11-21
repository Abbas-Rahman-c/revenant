// An in-process stand-in for a Web Worker. It runs the real worker host (serve) with any part
// implementation, delivering messages asynchronously like the browser does. Tests can also crash it.

import { serve, type PartImpl } from "../workers/host.js";
import type { FromWorker, ToWorker, WorkerLike, WorkerScope } from "../workers/protocol.js";

export type FakeWorker = WorkerLike & {
  terminated: boolean;
  crash(message?: string): void;
  sent: ToWorker[];
};

export function fakeWorker(impl: PartImpl): FakeWorker {
  const toMain: ((e: { data: FromWorker }) => void)[] = [];
  const onError: ((e: unknown) => void)[] = [];
  const toWorker: ((e: { data: ToWorker }) => void)[] = [];
  const later = (f: () => void) => setTimeout(f, 0);

  const scope: WorkerScope = {
    postMessage(m) {
      if (w.terminated) return;
      const copy = structuredClone(m);
      later(() => !w.terminated && toMain.forEach((l) => l({ data: copy })));
    },
    addEventListener(_t, l) {
      toWorker.push(l);
    },
  };

  const w: FakeWorker = {
    terminated: false,
    sent: [],
    postMessage(m) {
      if (w.terminated) return;
      w.sent.push(m);
      const copy = structuredClone(m);
      later(() => !w.terminated && toWorker.forEach((l) => l({ data: copy })));
    },
    addEventListener(type: "message" | "error", l: (e: never) => void) {
      if (type === "message") toMain.push(l as (e: { data: FromWorker }) => void);
      else onError.push(l as (e: unknown) => void);
    },
    terminate() {
      w.terminated = true;
    },
    crash(message = "boom") {
      later(() => onError.forEach((l) => l({ message })));
    },
  };
  serve(impl, scope);
  return w;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
