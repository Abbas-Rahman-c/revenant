/// <reference lib="webworker" />
// Entry point of the voice worker. All model work for this part happens here, never on the main thread.
import { serve } from "./host.js";
import { createVoiceImpl } from "../parts/voice.impl.js";
import type { WorkerScope } from "./protocol.js";

serve(createVoiceImpl(), self as unknown as WorkerScope);
