/// <reference lib="webworker" />
// Entry point of the ears worker. All model work for this part happens here, never on the main thread.
import { serve } from "./host.js";
import { createEarsImpl } from "../parts/ears.impl.js";
import type { WorkerScope } from "./protocol.js";

serve(createEarsImpl(), self as unknown as WorkerScope);
