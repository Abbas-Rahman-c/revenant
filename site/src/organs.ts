export type OrganId = "brain" | "eyes" | "ears" | "voice" | "memory";

export type Organ = {
  id: OrganId;
  name: string;
  /** What the part lets the creature do, in plain words. */
  does: string;
  /** The kind of model behind it. */
  model: string;
  /** The browser technology it is stitched from. */
  tech: string;
  /** Largest download for this part (the full tier), measured. Smaller devices get smaller models. */
  approxMB: number;
  /** Socket position on the creature, in the creature's 320 x 520 viewBox. */
  socket: { x: number; y: number };
};

export const ORGANS: Organ[] = [
  {
    id: "brain",
    name: "Brain",
    does: "Thinks and answers",
    model: "Small language model",
    tech: "WebGPU",
    approxMB: 350,
    socket: { x: 160, y: 62 },
  },
  {
    id: "eyes",
    name: "Eyes",
    does: "Sees what the camera sees",
    model: "Object detection",
    tech: "MediaPipe and WebAssembly",
    approxMB: 6,
    socket: { x: 160, y: 118 },
  },
  {
    id: "ears",
    name: "Ears",
    does: "Hears and writes down speech",
    model: "Speech to text (Whisper)",
    tech: "WebAssembly",
    approxMB: 42,
    socket: { x: 98, y: 132 },
  },
  {
    id: "voice",
    name: "Voice",
    does: "Speaks out loud",
    model: "Text to speech (Kokoro)",
    tech: "WebGPU and Web Audio",
    approxMB: 311,
    socket: { x: 160, y: 214 },
  },
  {
    id: "memory",
    name: "Memory",
    does: "Remembers you between visits",
    model: "Text embeddings (MiniLM)",
    tech: "IndexedDB",
    approxMB: 23,
    socket: { x: 196, y: 300 },
  },
];

export const ORGAN_BY_ID = Object.fromEntries(ORGANS.map((o) => [o.id, o])) as Record<OrganId, Organ>;

/** The creature's first words depend on what it was given. */
export function firstWords(parts: Set<OrganId>): string {
  if (!parts.has("brain")) return "…";
  if (parts.size === 5) return "I can see you. I can hear you. And I will remember this. Hello.";
  if (!parts.has("eyes")) return "Why is it so dark in here?";
  if (!parts.has("ears")) return "Your lips are moving. I hear nothing.";
  if (!parts.has("voice")) return "(It mouths a word. No sound comes out.)";
  if (!parts.has("memory")) return "Hello. Have we met? I won't remember.";
  return "Hello.";
}
