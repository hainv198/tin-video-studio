import { afterEach, describe, expect, it, vi } from "vitest";
import { RenderClient, type WorkerLike } from "@/client/render/RenderClient";
import type { WorkerMessage, WorkerRequest } from "@/client/render/RenderJob";

class FakeWorker implements WorkerLike {
  onmessage: ((e: { data: WorkerMessage }) => void) | null = null;
  onerror: ((e: { message?: string }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = 0;
  postMessage(_m: WorkerRequest): void {}
  terminate(): void {
    this.terminated++;
  }
}

afterEach(() => vi.useRealTimers());

describe("RenderClient.probe", () => {
  it("trả danh sách thiếu và đóng worker một lần", async () => {
    const w = new FakeWorker();
    const p = new RenderClient(() => w).probe();
    w.onmessage?.({ data: { type: "probe-result", missing: ["Canvas 2D trong worker"] } });
    await expect(p).resolves.toEqual(["Canvas 2D trong worker"]);
    expect(w.terminated).toBe(1);
  });

  it("worker im lặng thì quá thời gian chờ và báo lỗi tiếng Việt", async () => {
    vi.useFakeTimers();
    const w = new FakeWorker();
    const p = new RenderClient(() => w).probe(1000);
    const assertion = expect(p).rejects.toThrow("Bộ dựng không phản hồi");
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(w.terminated).toBe(1);
  });

  it("onmessageerror thì reject và đóng worker", async () => {
    const w = new FakeWorker();
    const p = new RenderClient(() => w).probe();
    w.onmessageerror?.();
    await expect(p).rejects.toThrow("Bộ dựng nhận dữ liệu lỗi");
    expect(w.terminated).toBe(1);
  });
});
