// The circle runtime's public entry point. The site imports only from here.

export { summon, type SummonOptions } from "./summon.js";
export { probeDevice } from "./sigil/probe.js";
export { chooseTier } from "./sigil/tier.js";
export { isCircleError } from "./errors.js";
export { splitSentences } from "./parts/text.js";
export { REGISTRY } from "./parts/registry.js";
export { openEyes, type EyesHandle, type Sight } from "./parts/eyes.js";
export type { BrowserEnv, DeviceFacts, Sigil, TierReason } from "./sigil/types.js";
export type {
  AnyPart,
  Audio,
  BrainHandle,
  CallOptions,
  ChatMessage,
  CircleError,
  EarsHandle,
  ErrorCode,
  HandleFor,
  Memory,
  MemoryHandle,
  PartId,
  Progress,
  Tier,
  VoiceHandle,
} from "./types.js";
