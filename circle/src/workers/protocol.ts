export type PartId = "voice" | "memory";
export type Progress = {
  stage: "checking" | "downloading" | "warming-up" | "ready";
  loadedBytes: number;
  totalBytes: number;
  fromCache: boolean;
};
export type CircleError = {
  code: "NO_WEBGPU" | "OUT_OF_MEMORY" | "LOW_STORAGE" | "DOWNLOAD_FAILED" | "MODEL_LOAD_FAILED" | "ABORTED";
  part: PartId;
  message: string;
};
export type WorkerIn =
  | { id: number; type: "load"; part: PartId; payload: { tier: string } }
  | { id: number; type: "run"; part: PartId; payload: any }
  | { id: number; type: "abort"; part: PartId; payload: {} };
export type WorkerOut =
  | { id: number; type: "progress"; payload: Progress }
  | { id: number; type: "result"; payload: any }
  | { id: number; type: "chunk"; payload: any }
  | { id: number; type: "error"; payload: CircleError };
