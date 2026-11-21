// Public types of the circle runtime: the contract between the site and the parts.

/** Parts that load a model in a worker through summon(). The eyes run on the main thread (parts/eyes.ts). */
export type PartId = "brain" | "ears" | "voice" | "memory";
export type AnyPart = PartId | "eyes";
export type Tier = "tiny" | "small" | "full";

export type Progress = {
  part: PartId;
  stage: "checking" | "downloading" | "warming-up" | "ready";
  /** 0 to 1. Always present, so a progress bar can bind to it. */
  fraction: number;
  /** Real byte counts when the library reports them (Transformers.js, Kokoro). WebLLM reports only a fraction. */
  loadedBytes?: number;
  totalBytes?: number;
  /** True when nothing had to be downloaded: the model came from browser storage. */
  fromCache: boolean;
};

export type ErrorCode =
  | "NO_WEBGPU"
  | "OUT_OF_MEMORY"
  | "LOW_STORAGE"
  | "DOWNLOAD_FAILED"
  | "MODEL_LOAD_FAILED"
  | "RUN_FAILED"
  | "ABORTED";

export type CircleError = { code: ErrorCode; part: AnyPart; message: string };

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type CallOptions = { signal?: AbortSignal };

export type Audio = { samples: Float32Array; sampleRate: number };

export type Memory = { id: number; text: string; time: number; score: number };

type Base = { tier: Tier; banish(): void };

export type BrainHandle = Base & {
  part: "brain";
  model: string;
  /** Streams the reply, token by token. */
  ask(messages: ChatMessage[], opts?: CallOptions & { maxTokens?: number }): AsyncIterable<string>;
};

export type EarsHandle = Base & {
  part: "ears";
  /** 16 kHz mono samples in, text out. */
  transcribe(samples: Float32Array, opts?: CallOptions): Promise<string>;
};

export type VoiceHandle = Base & {
  part: "voice";
  speak(text: string, opts?: CallOptions): Promise<Audio>;
  /** One sentence at a time, so the first can play while the next is made. */
  speakStream(text: string, opts?: CallOptions): AsyncIterable<Audio & { sentence: string }>;
};

export type MemoryHandle = Base & {
  part: "memory";
  /** True on the tiny tier: recall matches words instead of meaning. */
  keywordOnly: boolean;
  remember(text: string, opts?: CallOptions): Promise<number>;
  recall(query: string, k?: number, opts?: CallOptions): Promise<Memory[]>;
  /** With an id, forgets one memory; without, forgets everything. */
  forget(id?: number): Promise<void>;
};

export type HandleFor<P extends PartId> = P extends "brain"
  ? BrainHandle
  : P extends "ears"
    ? EarsHandle
    : P extends "voice"
      ? VoiceHandle
      : MemoryHandle;
