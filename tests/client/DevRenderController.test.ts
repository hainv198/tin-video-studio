import { describe, expect, it, vi } from "vitest";
import { DEV_SAMPLE, DevRenderController, type DevRenderDeps } from "@/client/controllers/DevRenderController";
import { RenderCancelledError } from "@/client/render/errors";
import type { RenderJob } from "@/client/render/RenderJob";

function deps(over: Partial<DevRenderDeps> = {}): DevRenderDeps & { jobs: RenderJob[] } {
  const jobs: RenderJob[] = [];
  return {
    jobs,
    support: async () => ({ ok: true, missing: [] }),
    tts: {
      voices: async () => [{ name: "vi-VN-Fake-A", gender: "FEMALE", tier: "Fake" }],
      synthesize: vi.fn(async () => new ArrayBuffer(8)),
    },
    decode: async () => ({ channels: [new Float32Array(48000)], durationSec: 1, sampleRate: 48000 }),
    fetchBytes: async () => new ArrayBuffer(8),
    render: async (job, onProgress) => {
      jobs.push(job);
      onProgress?.({ type: "progress", stage: "video", frame: 30, totalFrames: 60 });
      return { blob: new Blob(["mp4"]), durationSec: 12.3 };
    },
    cancel: () => {},
    createUrl: () => "blob:fake",
    revokeUrl: vi.fn(),
    origin: "http://localhost:3100",
    ...over,
  };
}

describe("DevRenderController", () => {
  it("trình duyệt thiếu hỗ trợ thì chuyển sang unsupported", async () => {
    const c = new DevRenderController(deps({ support: async () => ({ ok: false, missing: ["VideoEncoder"] }) }));
    await c.checkSupport();
    expect(c.state).toEqual({ status: "unsupported", missing: ["VideoEncoder"] });
  });

  it("tạo giọng từng câu, dựng job đúng và kết thúc ở done", async () => {
    const d = deps();
    const c = new DevRenderController(d);
    const labels: string[] = [];
    c.subscribe(() => {
      if (c.state.status === "working") labels.push(c.state.label);
    });
    await c.render("vi-VN-Fake-A");
    expect(c.state).toEqual({ status: "done", url: "blob:fake", durationSec: 12.3, sizeBytes: 3 });
    const job = d.jobs[0] as RenderJob;
    expect(job.templateId).toBe("theanh28");
    expect(job.scenes[0]?.role).toBe("intro");
    expect(job.scenes).toHaveLength(job.narrations.length);
    expect(d.tts.synthesize).toHaveBeenCalledTimes(job.scenes.length);
    expect(job.scenes.every((s) => s.footage.kind !== "fallback")).toBe(true);
    expect(job.music?.levelBelowVoiceDb).toBe(15);
    expect(job.project.publishDateText).toBe("14/10/2026");
    expect(labels[0]).toBe(`Tạo giọng 1/${job.scenes.length}`);
    expect(labels).toContain("Dựng hình 50%");
  });

  it("lỗi tạo giọng hiện thông báo của server", async () => {
    const { ApiError } = await import("@/client/services/AuthClient");
    const c = new DevRenderController(
      deps({
        tts: {
          voices: async () => [],
          synthesize: async () => {
            throw new ApiError(429, "QUOTA", "Hết hạn mức giọng đọc hôm nay, liên hệ Hải");
          },
        },
      }),
    );
    await c.render("vi-VN-Fake-A");
    expect(c.state).toEqual({ status: "error", message: "Hết hạn mức giọng đọc hôm nay, liên hệ Hải" });
  });

  it("huỷ thì quay về idle", async () => {
    const c = new DevRenderController(
      deps({
        render: async () => {
          throw new RenderCancelledError();
        },
      }),
    );
    await c.render("vi-VN-Fake-A");
    expect(c.state).toEqual({ status: "idle" });
  });

  it("mẫu dựng thử có 4 nguồn cảnh trám đã kiểm CORS", () => {
    expect(DEV_SAMPLE.footage).toHaveLength(4);
    expect(DEV_SAMPLE.sourceCredit).toBe("Đức Phong - VietNamNet");
  });

  const tick = () => new Promise<void>((r) => setTimeout(r, 0));

  it("huỷ khi đang tạo giọng thì dừng, không gọi render và về idle", async () => {
    let release: (() => void) | undefined;
    const synthesize = vi.fn(
      () =>
        new Promise<ArrayBuffer>((resolve) => {
          release = () => resolve(new ArrayBuffer(8));
        }),
    );
    const render = vi.fn(async () => ({ blob: new Blob(["mp4"]), durationSec: 1 }));
    const c = new DevRenderController(deps({ tts: { voices: async () => [], synthesize }, render }));
    const run = c.render("vi-VN-Fake-A");
    await tick();
    c.cancel();
    release?.();
    await run;
    expect(c.state).toEqual({ status: "idle" });
    expect(render).not.toHaveBeenCalled();
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it("huỷ khi đang nạp nhạc thì không gọi render", async () => {
    let release: (() => void) | undefined;
    const render = vi.fn(async () => ({ blob: new Blob(["mp4"]), durationSec: 1 }));
    const c = new DevRenderController(
      deps({
        fetchBytes: () =>
          new Promise<ArrayBuffer>((resolve) => {
            release = () => resolve(new ArrayBuffer(8));
          }),
        render,
      }),
    );
    const run = c.render("vi-VN-Fake-A");
    await tick();
    c.cancel();
    release?.();
    await run;
    expect(c.state).toEqual({ status: "idle" });
    expect(render).not.toHaveBeenCalled();
  });

  it("gọi render khi đang chạy thì bỏ qua", async () => {
    const synthesize = vi.fn(async () => {
      await tick();
      return new ArrayBuffer(8);
    });
    const c = new DevRenderController(deps({ tts: { voices: async () => [], synthesize } }));
    const first = c.render("vi-VN-Fake-A");
    await tick();
    const before = synthesize.mock.calls.length;
    await c.render("vi-VN-Fake-A");
    expect(synthesize.mock.calls.length).toBe(before);
    expect(c.state.status).toBe("working");
    await first;
    expect(c.state.status).toBe("done");
  });

  it("dựng lần hai sau done thì thu hồi URL cũ đúng một lần", async () => {
    const revokeUrl = vi.fn();
    const c = new DevRenderController(deps({ revokeUrl }));
    await c.render("vi-VN-Fake-A");
    expect(revokeUrl).not.toHaveBeenCalled();
    await c.render("vi-VN-Fake-A");
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith("blob:fake");
  });

  it("trạng thái error hoặc idle không thu hồi URL", async () => {
    const revokeUrl = vi.fn();
    let fail = true;
    const c = new DevRenderController(
      deps({
        revokeUrl,
        render: async () => {
          if (fail) throw new Error("hỏng");
          return { blob: new Blob(["mp4"]), durationSec: 1 };
        },
      }),
    );
    await c.render("vi-VN-Fake-A");
    expect(c.state.status).toBe("error");
    fail = false;
    await c.render("vi-VN-Fake-A");
    expect(revokeUrl).not.toHaveBeenCalled();
  });

  it("thanh tiến độ không lùi ở giai đoạn không có khung hình", async () => {
    const percents: number[] = [];
    const c = new DevRenderController(
      deps({
        render: async (_job, onProgress) => {
          onProgress?.({ type: "progress", stage: "video", frame: 30, totalFrames: 60 });
          if (c.state.status === "working") percents.push(c.state.percent);
          onProgress?.({ type: "progress", stage: "finalizing" });
          if (c.state.status === "working") percents.push(c.state.percent);
          return { blob: new Blob(["mp4"]), durationSec: 1 };
        },
      }),
    );
    await c.render("vi-VN-Fake-A");
    expect(percents).toHaveLength(2);
    expect(percents[1]).toBeGreaterThanOrEqual(percents[0] as number);
  });

  it("checkSupport không ghi đè trạng thái working", async () => {
    let release: (() => void) | undefined;
    const c = new DevRenderController(
      deps({
        support: async () => {
          await new Promise<void>((r) => {
            release = r;
          });
          return { ok: false, missing: ["VideoEncoder"] };
        },
        fetchBytes: () => new Promise<ArrayBuffer>(() => {}),
      }),
    );
    const check = c.checkSupport();
    void c.render("vi-VN-Fake-A");
    await tick();
    expect(c.state.status).toBe("working");
    release?.();
    await check;
    expect(c.state.status).toBe("working");
  });

  it("tần số mẫu giải mã khác 48 kHz thì báo lỗi, không dựng", async () => {
    const d = deps({ decode: async () => ({ channels: [new Float32Array(44100)], durationSec: 1, sampleRate: 44100 }) });
    const c = new DevRenderController(d);
    await c.render("vi-VN-Fake-A");
    expect(c.state).toEqual({ status: "error", message: "Âm thanh giải mã sai tần số mẫu (44100 Hz thay vì 48000 Hz)" });
    expect(d.jobs).toHaveLength(0);
  });
});
