import { describe, expect, it } from "vitest";
import { RenderClient, type WorkerLike } from "@/client/render/RenderClient";
import { RenderCancelledError } from "@/client/render/errors";
import type { RenderJob, WorkerMessage, WorkerRequest } from "@/client/render/RenderJob";

class FakeWorker implements WorkerLike {
  onmessage: ((e: { data: WorkerMessage }) => void) | null = null;
  onerror: ((e: { message?: string }) => void) | null = null;
  readonly sent: WorkerRequest[] = [];
  terminated = false;
  postMessage(m: WorkerRequest): void {
    this.sent.push(m);
  }
  terminate(): void {
    this.terminated = true;
  }
  emit(data: WorkerMessage): void {
    this.onmessage?.({ data });
  }
}

const job = { templateId: "theanh28" } as unknown as RenderJob;

describe("RenderClient", () => {
  it("gửi job, chuyển tiến độ, trả blob và đóng worker", async () => {
    const w = new FakeWorker();
    const client = new RenderClient(() => w);
    const stages: string[] = [];
    const promise = client.render(job, (p) => stages.push(p.stage));
    expect(w.sent).toEqual([{ type: "start", job }]);
    w.emit({ type: "progress", stage: "video", frame: 15, totalFrames: 30 });
    const blob = new Blob(["x"]);
    w.emit({ type: "done", blob, durationSec: 1 });
    await expect(promise).resolves.toEqual({ blob, durationSec: 1 });
    expect(stages).toEqual(["video"]);
    expect(w.terminated).toBe(true);
  });

  it("worker báo lỗi thì reject với thông điệp", async () => {
    const w = new FakeWorker();
    const promise = new RenderClient(() => w).render(job);
    w.emit({ type: "error", message: "Hỏng" });
    await expect(promise).rejects.toThrow("Hỏng");
    expect(w.terminated).toBe(true);
  });

  it("lỗi nạp worker thì reject", async () => {
    const w = new FakeWorker();
    const promise = new RenderClient(() => w).render(job);
    w.onerror?.({ message: "không nạp được" });
    await expect(promise).rejects.toThrow("Lỗi bộ dựng: không nạp được");
  });

  it("cancel dừng worker và reject RenderCancelledError", async () => {
    const w = new FakeWorker();
    const client = new RenderClient(() => w);
    const promise = client.render(job);
    client.cancel();
    await expect(promise).rejects.toBeInstanceOf(RenderCancelledError);
    expect(w.terminated).toBe(true);
  });
});
