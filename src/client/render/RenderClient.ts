import { RenderCancelledError } from "./errors";
import type { RenderJob, WorkerMessage, WorkerRequest } from "./RenderJob";

export interface WorkerLike {
  onmessage: ((e: { data: WorkerMessage }) => void) | null;
  onerror: ((e: { message?: string }) => void) | null;
  postMessage(message: WorkerRequest): void;
  terminate(): void;
}

type Progress = Extract<WorkerMessage, { type: "progress" }>;

const defaultWorker = (): WorkerLike =>
  new Worker(new URL("./render.worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike;

export class RenderClient {
  private active: { worker: WorkerLike; reject: (e: Error) => void } | null = null;

  constructor(private readonly createWorker: () => WorkerLike = defaultWorker) {}

  render(job: RenderJob, onProgress?: (p: Progress) => void): Promise<{ blob: Blob; durationSec: number }> {
    return new Promise((resolve, reject) => {
      const worker = this.createWorker();
      const finish = () => {
        worker.terminate();
        this.active = null;
      };
      this.active = { worker, reject };
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === "progress") onProgress?.(m);
        else if (m.type === "done") {
          finish();
          resolve({ blob: m.blob, durationSec: m.durationSec });
        } else {
          finish();
          reject(new Error(m.message));
        }
      };
      worker.onerror = (e) => {
        finish();
        reject(new Error(`Lỗi bộ dựng: ${e.message ?? "không rõ"}`));
      };
      worker.postMessage({ type: "start", job });
    });
  }

  cancel(): void {
    if (!this.active) return;
    const { worker, reject } = this.active;
    worker.terminate();
    this.active = null;
    reject(new RenderCancelledError());
  }
}
