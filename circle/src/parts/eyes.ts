// Eyes part: object detection on the camera, with MediaPipe Tasks Vision.
// It runs on the main thread because it reads frames straight from a <video> element; the model is small (7 MB)
// and each detection takes a few milliseconds on the GPU delegate.
// API verified in @mediapipe/tasks-vision 1.2.3 vision.d.ts: FilesetResolver.forVisionTasks(basePath),
// ObjectDetector.createFromOptions(fileset, { baseOptions: { modelAssetPath, delegate }, runningMode, scoreThreshold, maxResults }),
// detector.detectForVideo(video, timestampMs) -> { detections: [{ categories: [{ categoryName, score }] }] }.

import { circleError, toCircleError } from "../errors.js";
import type { CircleError } from "../types.js";

export const EYES_MODEL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";
export const EYES_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";

export type Sight = { label: string; score: number };

export type EyesHandle = {
  /** What is in front of the camera right now, most confident first. */
  look(): Sight[];
  /** Plain words for the brain: "a person and a cup". Empty when it sees nothing. */
  describe(): string;
  video: HTMLVideoElement;
  close(): void;
};

type Detector = {
  detectForVideo(v: HTMLVideoElement, t: number): { detections: { categories: { categoryName: string; score: number }[] }[] };
  close(): void;
};

/** Opens the camera and loads the detector. Rejects with a CircleError (camera denied becomes RUN_FAILED). */
export async function openEyes(opts: { signal?: AbortSignal } = {}): Promise<EyesHandle> {
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false });
  } catch (e) {
    throw circleError("RUN_FAILED", "eyes", `The camera is not available: ${(e as Error)?.name ?? e}`) as CircleError;
  }
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  try {
    await video.play();
    const { FilesetResolver, ObjectDetector } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(EYES_WASM);
    const make = (delegate: "GPU" | "CPU") =>
      ObjectDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: EYES_MODEL, delegate },
        runningMode: "VIDEO",
        scoreThreshold: 0.45,
        maxResults: 5,
      });
    const detector = (await make("GPU").catch(() => make("CPU"))) as unknown as Detector;
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    let last = 0;
    let cache: Sight[] = [];
    const look = () => {
      const now = performance.now();
      if (now - last < 250 || video.readyState < 2) return cache; // at most four looks a second
      last = now;
      const r = detector.detectForVideo(video, now);
      const best = new Map<string, number>();
      for (const d of r.detections) {
        const c = d.categories[0];
        if (c && c.score > (best.get(c.categoryName) ?? 0)) best.set(c.categoryName, c.score);
      }
      cache = [...best].map(([label, score]) => ({ label, score })).sort((a, b) => b.score - a.score);
      return cache;
    };
    return {
      video,
      look,
      describe() {
        const labels = look().map((s) => s.label);
        if (!labels.length) return "";
        const a = (w: string) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);
        const ws = labels.map(a);
        return ws.length === 1 ? ws[0] : `${ws.slice(0, -1).join(", ")} and ${ws.at(-1)}`;
      },
      close() {
        detector.close();
        stream?.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      },
    };
  } catch (e) {
    stream?.getTracks().forEach((t) => t.stop());
    const err = toCircleError(e, "eyes", "load");
    throw { ...err, message: `The eyes could not open: ${err.message}` } as CircleError;
  }
}
