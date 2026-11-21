import type { CircleError, ErrorCode, PartId } from "./types.js";

export const ERROR_CODES: readonly ErrorCode[] = [
  "NO_WEBGPU",
  "OUT_OF_MEMORY",
  "LOW_STORAGE",
  "DOWNLOAD_FAILED",
  "MODEL_LOAD_FAILED",
  "RUN_FAILED",
  "ABORTED",
];

export function circleError(code: ErrorCode, part: PartId, message: string): CircleError {
  return { code, part, message };
}

export function isCircleError(x: unknown): x is CircleError {
  if (typeof x !== "object" || x === null) return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.code === "string" &&
    (ERROR_CODES as readonly string[]).includes(e.code) &&
    typeof e.part === "string" &&
    typeof e.message === "string"
  );
}

function messageOf(x: unknown): string {
  if (typeof x === "string") return x;
  if (x instanceof Error) return x.message;
  if (typeof x === "object" && x !== null && typeof (x as { message?: unknown }).message === "string") {
    return (x as { message: string }).message;
  }
  try {
    return String(x);
  } catch {
    return "Unknown error";
  }
}

/**
 * Turns anything thrown into a CircleError. The fallback code depends on where it happened:
 * loading a model, or running one. Known failure messages are mapped to more specific codes.
 */
export function toCircleError(x: unknown, part: PartId, during: "load" | "run"): CircleError {
  if (isCircleError(x)) return x;
  const message = messageOf(x) || "Unknown error";
  const name = x instanceof Error ? x.name : "";
  if (name === "AbortError") return circleError("ABORTED", part, "Aborted");
  if (/out of memory|allocation failed|oom\b|memory access out of bounds|device was lost/i.test(message)) {
    return circleError("OUT_OF_MEMORY", part, message);
  }
  if (/quota|storage.*full|QuotaExceeded/i.test(message) || name === "QuotaExceededError") {
    return circleError("LOW_STORAGE", part, message);
  }
  if (during === "load" && /fetch|network|download|failed to load|404|status \d{3}/i.test(message)) {
    return circleError("DOWNLOAD_FAILED", part, message);
  }
  if (/webgpu|navigator\.gpu|no (gpu )?adapter|shader-f16/i.test(message) && during === "load") {
    return circleError("NO_WEBGPU", part, message);
  }
  return circleError(during === "load" ? "MODEL_LOAD_FAILED" : "RUN_FAILED", part, message);
}
