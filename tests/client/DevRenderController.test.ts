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
});
