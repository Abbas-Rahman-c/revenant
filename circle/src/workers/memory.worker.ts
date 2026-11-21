/// <reference lib="webworker" />
// Entry point of the memory worker. All model work for this part happens here, never on the main thread.
import { serve } from "./host.js";
import { createMemoryImpl } from "../parts/memory.impl.js";
import type { WorkerScope } from "./protocol.js";

serve(createMemoryImpl(), self as unknown as WorkerScope);
