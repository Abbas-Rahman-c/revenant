// Main-thread handles: typed wrappers that turn handle calls into worker requests.

import { circleError } from "./errors.js";
import { splitSentences } from "./parts/text.js";
import type { Conn } from "./workers/conn.js";
import type {
  Audio,
  BrainHandle,
  CallOptions,
  ChatMessage,
  EarsHandle,
  Memory,
  MemoryHandle,
  PartId,
  Tier,
  VoiceHandle,
} from "./types.js";

/** Turns pushed chunks into an async iterable that ends with the request. */
function stream<T>(start: (push: (v: T) => void) => Promise<unknown>): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      const queue: T[] = [];
      let done = false;
      let error: unknown = null;
      let wake: (() => void) | null = null;
      const notify = () => {
        const w = wake;
        wake = null;
        w?.();
      };
      start((v) => {
        queue.push(v);
        notify();
      }).then(
        () => {
          done = true;
          notify();
        },
        (e) => {
          error = e;
          done = true;
          notify();
        },
      );
      return {
        async next(): Promise<IteratorResult<T>> {
          for (;;) {
            if (queue.length) return { value: queue.shift()!, done: false };
            if (done) {
              if (error) throw error;
              return { value: undefined, done: true };
            }
            await new Promise<void>((r) => (wake = r));
          }
        },
      };
    },
  };
}

function join(chunks: Float32Array[]): Float32Array {
  let n = 0;
  for (const c of chunks) n += c.length;
  const out = new Float32Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function base(conn: Conn, tier: Tier) {
  return { tier, banish: () => conn.terminate() };
}

export function brainHandle(conn: Conn, tier: Tier, model: string): BrainHandle {
  return {
    part: "brain",
    model,
    ...base(conn, tier),
    ask(messages: ChatMessage[], opts: CallOptions & { maxTokens?: number } = {}) {
      return stream<string>((push) =>
        conn.request(
          { type: "run", op: "ask", args: { messages, maxTokens: opts.maxTokens } },
          { signal: opts.signal, onChunk: (v) => typeof v === "string" && push(v) },
        ),
      );
    },
  };
}

export function earsHandle(conn: Conn, tier: Tier): EarsHandle {
  return {
    part: "ears",
    ...base(conn, tier),
    async transcribe(samples, opts = {}) {
      return String(await conn.request({ type: "run", op: "transcribe", args: { samples } }, { signal: opts.signal }));
    },
  };
}

export function voiceHandle(conn: Conn, tier: Tier): VoiceHandle {
  const one = async (sentence: string, signal?: AbortSignal): Promise<Audio> => {
    const r = (await conn.request({ type: "run", op: "speak", args: { text: sentence } }, { signal })) as Audio;
    return { samples: r.samples, sampleRate: r.sampleRate };
  };
  const speakStream = (text: string, opts: CallOptions = {}): AsyncIterable<Audio & { sentence: string }> => ({
    async *[Symbol.asyncIterator]() {
      for (const sentence of splitSentences(text)) {
        if (opts.signal?.aborted) throw circleError("ABORTED", "voice", "Aborted");
        yield { sentence, ...(await one(sentence, opts.signal)) };
      }
    },
  });
  return {
    part: "voice",
    ...base(conn, tier),
    speakStream,
    async speak(text, opts = {}) {
      const parts: Float32Array[] = [];
      let sampleRate = 24000;
      for await (const a of speakStream(text, opts)) {
        parts.push(a.samples);
        sampleRate = a.sampleRate;
      }
      return { samples: join(parts), sampleRate };
    },
  };
}

export function memoryHandle(conn: Conn, tier: Tier): MemoryHandle {
  return {
    part: "memory",
    keywordOnly: tier === "tiny",
    ...base(conn, tier),
    async remember(text, opts = {}) {
      return Number(await conn.request({ type: "run", op: "remember", args: { text } }, { signal: opts.signal }));
    },
    async recall(query, k = 5, opts = {}) {
      return (await conn.request({ type: "run", op: "recall", args: { query, k } }, { signal: opts.signal })) as Memory[];
    },
    async forget(id) {
      await conn.request({ type: "run", op: "forget", args: { id } });
    },
  };
}

export type AnyHandle = BrainHandle | EarsHandle | VoiceHandle | MemoryHandle;
export type { PartId };
