/// <reference lib="webworker" />
// Entry point of the brain worker. All model work for this part happens here, never on the main thread.
import { serve } from "./host.js";
import { createBrainImpl } from "../parts/brain.impl.js";
import type { WorkerScope } from "./protocol.js";

serve(createBrainImpl(), self as unknown as WorkerScope);
