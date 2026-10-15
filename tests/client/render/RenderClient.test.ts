import { describe, expect, it } from "vitest";
import { RenderClient, type WorkerLike } from "@/client/render/RenderClient";
import { RenderCancelledError } from "@/client/render/errors";
import type { RenderJob, WorkerMessage, WorkerRequest } from "@/client/render/RenderJob";

class FakeWorker implements WorkerLike {
  onmessage: ((e: { data: WorkerMessage }) => void) | null = null;
  onerror: ((e: { message?: string }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
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

class ThrowingWorker extends FakeWorker {
  postMessage(): void {
    throw new Error("clone failed");
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
  it("render chồng lên khi đang dựng thì reject và không tạo worker thứ hai", async () => {
    const workers: FakeWorker[] = [];
    const client = new RenderClient(() => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    });
    const first = client.render(job);
    await expect(client.render(job)).rejects.toThrow("Đang dựng video khác, hãy chờ hoặc huỷ");
    expect(workers).toHaveLength(1);
    workers[0]?.emit({ type: "done", blob: new Blob(["x"]), durationSec: 1 });
    await first;
  });

  it("dựng xong thì render mới chạy lại được; cancel sau khi xong không làm gì", async () => {
    const workers: FakeWorker[] = [];
    const client = new RenderClient(() => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    });
    const first = client.render(job);
    workers[0]?.emit({ type: "done", blob: new Blob(["x"]), durationSec: 1 });
    await first;
    expect(() => client.cancel()).not.toThrow();
    const second = client.render(job);
    expect(workers).toHaveLength(2);
    client.cancel();
    await expect(second).rejects.toBeInstanceOf(RenderCancelledError);
    expect(workers[1]?.terminated).toBe(true);
  });

  it("postMessage ném lỗi thì terminate, reject và cho dựng lại", async () => {
    const bad = new ThrowingWorker();
    const good = new FakeWorker();
    const queue: FakeWorker[] = [bad, good];
    const client = new RenderClient(() => queue.shift() as FakeWorker);
    await expect(client.render(job)).rejects.toThrow("Không gửi được dữ liệu cho bộ dựng");
    expect(bad.terminated).toBe(true);
    const next = client.render(job);
    good.emit({ type: "done", blob: new Blob(["x"]), durationSec: 1 });
    await expect(next).resolves.toBeDefined();
  });

  it("onmessageerror thì reject và terminate", async () => {
    const w = new FakeWorker();
    const promise = new RenderClient(() => w).render(job);
    w.onmessageerror?.();
    await expect(promise).rejects.toThrow("Bộ dựng nhận dữ liệu lỗi");
    expect(w.terminated).toBe(true);
  });

  it("worker cũ báo xong muộn không làm mất trạng thái của lần dựng mới (cancel vẫn dừng được)", async () => {
    const a = new FakeWorker();
    const b = new FakeWorker();
    const workers = [a, b];
    const client = new RenderClient(() => workers.shift() as FakeWorker);
    const first = client.render(job);
    client.cancel();
    await expect(first).rejects.toBeInstanceOf(RenderCancelledError);
    const second = client.render(job);
    a.emit({ type: "done", blob: new Blob(["cũ"]), durationSec: 1 });
    client.cancel();
    await expect(second).rejects.toBeInstanceOf(RenderCancelledError);
    expect(b.terminated).toBe(true);
  });
});
