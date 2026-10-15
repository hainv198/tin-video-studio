import { RenderCancelledError } from "./errors";
import type { RenderJob, WorkerMessage, WorkerRequest } from "./RenderJob";

export interface WorkerLike {
  onmessage: ((e: { data: WorkerMessage }) => void) | null;
  onerror: ((e: { message?: string }) => void) | null;
  onmessageerror?: (() => void) | null;
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
    if (this.active) return Promise.reject(new Error("Đang dựng video khác, hãy chờ hoặc huỷ"));
    return new Promise((resolve, reject) => {
      const worker = this.createWorker();
      const finish = () => {
        worker.terminate();
        if (this.active?.worker === worker) this.active = null;
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
      worker.onmessageerror = () => {
        finish();
        reject(new Error("Bộ dựng nhận dữ liệu lỗi"));
      };
      try {
        worker.postMessage({ type: "start", job });
      } catch {
        finish();
        reject(new Error("Không gửi được dữ liệu cho bộ dựng"));
      }
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
