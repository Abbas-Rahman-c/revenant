// The creature's mind: summons the stitched parts and runs one conversation turn at a time.
//   hear (ears) or type  ->  recall (memory)  ->  think (brain, streamed)  ->  speak (voice, per sentence)
// Every part is optional. A missing part changes the creature, never breaks it.

import {
  isCircleError,
  probeDevice,
  splitSentences,
  summon,
  type BrainHandle,
  type ChatMessage,
  type CircleError,
  type EarsHandle,
  type EyesHandle,
  type MemoryHandle,
  type PartId,
  type Progress,
  type Sigil,
  type VoiceHandle,
} from "circle";
import type { OrganId } from "./organs";
import { playSamples, speak as speakBrowser, stopSpeech } from "./sound";

export type PartState = {
  stage: Progress["stage"] | "failed" | "waiting";
  fraction: number;
  loadedBytes?: number;
  totalBytes?: number;
  fromCache: boolean;
  error?: CircleError;
  tier?: string;
};

export type Handles = {
  brain?: BrainHandle;
  ears?: EarsHandle;
  voice?: VoiceHandle;
  memory?: MemoryHandle;
};

const RUNTIME_PARTS: PartId[] = ["brain", "voice", "ears", "memory"]; // brain first: it is the slowest

let sigilPromise: Promise<Sigil> | null = null;
/** The device sigil, probed once. `?tier=tiny|small|full` in the address overrides the tier (for demos and testing). */
export const deviceSigil = () =>
  (sigilPromise ??= probeDevice().then((s) => {
    const forced = new URLSearchParams(location.search).get("tier");
    return forced === "tiny" || forced === "small" || forced === "full" ? { ...s, tier: forced, reasons: [] } : s;
  }));

/** Summons every stitched part in parallel. Resolves when each has loaded or failed. */
export async function summonParts(
  stitched: Set<OrganId>,
  onState: (id: PartId, s: PartState) => void,
  signal: AbortSignal,
): Promise<Handles> {
  const sigil = await deviceSigil();
  const handles: Handles = {};
  await Promise.all(
    RUNTIME_PARTS.filter((p) => stitched.has(p)).map(async (part) => {
      onState(part, { stage: "waiting", fraction: 0, fromCache: false });
      try {
        const h = await summon(part, {
          sigil,
          signal,
          onProgress: (p) => onState(part, { ...p }),
        });
        (handles as Record<PartId, unknown>)[part] = h;
        onState(part, { stage: "ready", fraction: 1, fromCache: false, tier: h.tier });
      } catch (e) {
        const error: CircleError = isCircleError(e) ? e : { code: "MODEL_LOAD_FAILED", part, message: String(e) };
        onState(part, { stage: "failed", fraction: 0, fromCache: false, error });
      }
    }),
  );
  return handles;
}

/** What to tell the visitor when a part could not be stitched on. */
export function failureLine(part: PartId, e: CircleError): string {
  if (e.code === "ABORTED") return "Unplugged.";
  const why: Partial<Record<CircleError["code"], string>> = {
    NO_WEBGPU: "needs a graphics card this browser won't share (WebGPU)",
    OUT_OF_MEMORY: "didn't fit in memory",
    LOW_STORAGE: "didn't fit in storage",
    DOWNLOAD_FAILED: "couldn't be downloaded",
  };
  const after: Record<PartId, string> = {
    brain: "It wakes, but can only repeat what it was taught.",
    voice: "It will answer in subtitles, with the browser's own voice.",
    ears: "Type to it instead.",
    memory: "It will forget you when you leave.",
  };
  return `${why[e.code] ?? "failed to load"}. ${after[part]}`;
}

const PERSONA = `You are a creature stitched together from small AI models and brought to life a moment ago, on a lab table, by lightning.
You live inside the web browser of the person talking to you, on their own device. Nothing you hear or say leaves it.
You are newly awake, curious, a little theatrical, and gentle. You marvel at simple things: rain, light, a voice.
Always speak directly to the person as "you". Never call them "the visitor" and never guess their gender.
Answer in one to three short sentences of plain spoken words: no lists, no emoji, no stage directions.
Never claim to be a character from a book or film. If asked what you are, say you were stitched from small AI models running in this browser.`;

const SCRIPTED = [
  "I... I am awake. But my thoughts are borrowed. I have no brain of my own yet.",
  "Your words reach me, but I cannot think about them. Stitch a brain on me.",
  "I only know the words I was given. Give me a brain, and I will find my own.",
  "Something is missing up here. Something that thinks.",
];

export type TurnEvents = {
  onToken?(text: string): void;
  onSpeaking?(on: boolean): void;
  signal?: AbortSignal;
};

export class Mind {
  private history: ChatMessage[] = [];
  private scripted = 0;
  /** Set when the visitor opens the creature's eyes (camera) in talk mode. */
  eyes: EyesHandle | null = null;
  constructor(
    public handles: Handles,
    private stitched: Set<OrganId>,
  ) {}

  get canHear() {
    return !!this.handles.ears;
  }

  /** The visitor said `text` (typed or heard). Streams the reply and speaks it. Returns the full reply. */
  async reply(text: string, ev: TurnEvents = {}): Promise<string> {
    const { brain, memory } = this.handles;
    if (!brain) {
      const line = SCRIPTED[this.scripted++ % SCRIPTED.length];
      ev.onToken?.(line);
      await this.say(line, ev);
      return line;
    }

    const recalled = memory ? await memory.recall(text, 3, { signal: ev.signal }).catch(() => []) : [];
    const same = (a: string) => a.trim().toLowerCase() === text.trim().toLowerCase();
    const known = recalled
      .filter((m) => m.score > (memory?.keywordOnly ? 0.3 : 0.35) && !same(m.text))
      .map((m) => `"${m.text}"`);
    // Small models follow the end of the prompt best: keep the system prompt short and put what the
    // creature remembers and sees right next to the question.
    const senses = [
      this.stitched.has("memory") ? "" : "You have no memory, so you will forget this person when they leave.",
      this.stitched.has("eyes") ? "" : "You have no eyes and cannot see.",
    ].filter(Boolean);
    const seen = this.eyes?.describe() ?? "";
    const context = [
      known.length ? `(You remember this person told you: ${known.join(" ")})` : "",
      seen ? `(Through their camera you can see ${seen}.)` : "",
    ].filter(Boolean);

    const messages: ChatMessage[] = [
      { role: "system", content: [PERSONA, ...senses].join("\n") },
      ...this.history.slice(-6),
      { role: "user", content: context.length ? `${text}\n\n${context.join("\n")}` : text },
    ];
    if (import.meta.env.DEV) (window as unknown as { __lastPrompt: unknown }).__lastPrompt = messages;

    // Speak each sentence as soon as the brain finishes it.
    let full = "";
    let spoken = 0;
    const queue: Promise<void>[] = [];
    const flush = (final: boolean) => {
      const sentences = splitSentences(full);
      const ready = final ? sentences.length : sentences.length - 1; // the last one may be unfinished
      for (; spoken < ready; spoken++) {
        const s = sentences[spoken];
        queue.push((queue.at(-1) ?? Promise.resolve()).then(() => this.say(s, ev)));
      }
    };
    // Stop after three sentences: small models ramble.
    const enough = new AbortController();
    const signal = ev.signal ? AbortSignal.any([ev.signal, enough.signal]) : enough.signal;
    try {
      for await (const t of brain.ask(messages, { signal, maxTokens: 90 })) {
        full += t;
        if (splitSentences(full).length > 3) {
          full = splitSentences(full).slice(0, 3).join(" ");
          enough.abort();
          break;
        }
        ev.onToken?.(full);
        flush(false);
      }
    } catch (e) {
      if (!enough.signal.aborted) throw e; // our own stop is not an error
    }
    ev.onToken?.(full);
    flush(true);
    await Promise.all(queue);

    this.history.push({ role: "user", content: text }, { role: "assistant", content: full });
    // Remember statements about the person, not questions to the creature.
    const said = text.trim();
    if (memory && !said.endsWith("?") && said.split(/\s+/).length >= 3) void memory.remember(said).catch(() => {});
    return full.trim();
  }

  /** Says one line with the stitched voice, or the browser's voice, or not at all (no voice part: subtitles only). */
  async say(line: string, ev: TurnEvents = {}): Promise<void> {
    if (!this.stitched.has("voice")) return;
    const voice = this.handles.voice;
    if (voice) {
      try {
        for await (const a of voice.speakStream(line, { signal: ev.signal })) {
          await playSamples(a.samples, a.sampleRate, () => ev.onSpeaking?.(true), () => ev.onSpeaking?.(false));
        }
        return;
      } catch (e) {
        if (isCircleError(e) && e.code === "ABORTED") return;
        // fall through to the browser voice
      }
    }
    await new Promise<void>((done) =>
      speakBrowser(line, () => ev.onSpeaking?.(true), () => {
        ev.onSpeaking?.(false);
        done();
      }),
    );
  }

  banish() {
    stopSpeech();
    this.eyes?.close();
    this.eyes = null;
    for (const h of Object.values(this.handles)) h?.banish();
    this.handles = {};
  }
}

/** Records from the mic. Call the returned function to stop and get 16 kHz mono samples. */
export async function startRecording(): Promise<() => Promise<Float32Array>> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const ctx = new AudioContext({ sampleRate: 16000 });
  const src = ctx.createMediaStreamSource(stream);
  const chunks: Float32Array[] = [];
  // ScriptProcessor is deprecated but works everywhere without a separate worklet file.
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  src.connect(proc);
  proc.connect(ctx.destination);
  return async () => {
    proc.disconnect();
    src.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    await ctx.close();
    const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  };
}
