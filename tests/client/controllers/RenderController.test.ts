import { describe, expect, it, vi } from "vitest";
import { RenderController } from "@/client/controllers/RenderController";
import { ApiError } from "@/client/services/apiError";
import { RenderCancelledError } from "@/client/render/errors";
import type { RenderJob } from "@/client/render/RenderJob";
import { makeSessionWithProject } from "../../helpers/studioFixtures";

const job = { templateId: "theanh28" } as unknown as RenderJob;

function setup(opts: {
  build?: () => Promise<{ job: RenderJob; warnings: string[] }>;
  render?: RenderControllerRender;
  support?: () => Promise<{ ok: boolean; missing: string[] }>;
  probeWorker?: () => Promise<string[]>;
} = {}) {
  const made = makeSessionWithProject(2);
  const urls: string[] = [];
  const revoked: string[] = [];
  const authLost = vi.fn();
  const cancelRender = vi.fn();
  const ctrl = new RenderController({
    session: made.session,
    builder: { build: opts.build ?? (async () => ({ job, warnings: ["Cảnh báo thử"] })) },
    render: opts.render ?? (async () => ({ blob: new Blob(["mp4"]), durationSec: 12.5 })),
    cancelRender,
    support: opts.support ?? (async () => ({ ok: true, missing: [] })),
    probeWorker: opts.probeWorker ?? (async () => []),
    createUrl: () => {
      const u = `blob:${urls.length}`;
      urls.push(u);
      return u;
    },
    revokeUrl: (u) => revoked.push(u),
    onAuthLost: authLost,
  });
  return { ...made, ctrl, urls, revoked, authLost, cancelRender };
}

type RenderControllerRender = ConstructorParameters<typeof RenderController>[0]["render"];

describe("RenderController", () => {
  it("start dựng xong: có url, thời lượng, dung lượng, tên file và cảnh báo", async () => {
    const { ctrl } = setup();
    await ctrl.start();
    expect(ctrl.state).toEqual({
      status: "done",
      url: "blob:0",
      durationSec: 12.5,
      sizeBytes: 3,
      fileName: "tieu-de-ban-tin_20261014.mp4",
      warnings: ["Cảnh báo thử"],
      stale: false,
    });
  });

  it("markStale đánh dấu bản đã dựng là cũ một lần, bỏ qua khi chưa xong", async () => {
    const { ctrl } = setup();
    ctrl.markStale();
    expect(ctrl.state.status).toBe("idle");
    await ctrl.start();
    ctrl.markStale();
    expect(ctrl.state).toMatchObject({ status: "done", stale: true });
    const after = ctrl.state;
    ctrl.markStale();
    expect(ctrl.state).toBe(after);
  });

  it("tiến độ: 0–25 % chuẩn bị, 25–95 % dựng hình", async () => {
    const seen: number[] = [];
    const labels: string[] = [];
    let ctrlRef: RenderController | null = null;
    const made = setup({
      build: async () => {
        return { job, warnings: [] };
      },
      render: async (_job, onProgress) => {
        onProgress?.({ type: "progress", stage: "video", frame: 15, totalFrames: 30 });
        const s = ctrlRef!.state;
        if (s.status === "working") {
          seen.push(s.percent);
          labels.push(s.label);
        }
        return { blob: new Blob(["x"]), durationSec: 1 };
      },
    });
    ctrlRef = made.ctrl;
    await made.ctrl.start();
    expect(labels).toEqual(["Dựng hình 50%"]);
    expect(seen[0]).toBeCloseTo(60, 5);
  });

  it("lỗi thì báo thông điệp tiếng Việt; hết phiên thì onAuthLost", async () => {
    const failing = setup({ build: async () => { throw new Error("Lỗi bộ dựng: không rõ"); } });
    await failing.ctrl.start();
    expect(failing.ctrl.state).toEqual({ status: "error", message: "Lỗi bộ dựng: không rõ" });

    const expired = setup({ build: async () => { throw new ApiError(401, "AUTH", "Hết phiên đăng nhập, hãy đăng nhập lại"); } });
    await expired.ctrl.start();
    expect(expired.authLost).toHaveBeenCalledTimes(1);
    expect(expired.ctrl.state.status).toBe("error");
  });

  it("huỷ thì về trạng thái rỗi", async () => {
    const { ctrl, cancelRender } = setup({
      render: async () => {
        throw new RenderCancelledError();
      },
    });
    await ctrl.start();
    expect(ctrl.state).toEqual({ status: "idle" });
    ctrl.cancel();
    expect(cancelRender).toHaveBeenCalled();
  });

  it("dựng lại thì thu hồi url cũ; dispose thu hồi url hiện tại", async () => {
    const { ctrl, revoked } = setup();
    await ctrl.start();
    await ctrl.start();
    expect(revoked).toEqual(["blob:0"]);
    ctrl.dispose();
    expect(revoked).toEqual(["blob:0", "blob:1"]);
  });

  it("trình duyệt thiếu khả năng thì khoá bước dựng", async () => {
    const { ctrl } = setup({ support: async () => ({ ok: false, missing: ["VideoEncoder"] }) });
    await ctrl.checkSupport();
    expect(ctrl.state).toEqual({ status: "unsupported", missing: ["VideoEncoder"] });
    await ctrl.start();
    expect(ctrl.state.status).toBe("unsupported");
  });

  it("worker thiếu khả năng hoặc không phản hồi cũng khoá bước dựng", async () => {
    const missing = setup({ probeWorker: async () => ["Canvas 2D trong worker"] });
    await missing.ctrl.checkSupport();
    expect(missing.ctrl.state).toEqual({ status: "unsupported", missing: ["Canvas 2D trong worker"] });

    const silent = setup({ probeWorker: async () => { throw new Error("Bộ dựng không phản hồi"); } });
    await silent.ctrl.checkSupport();
    expect(silent.ctrl.state).toEqual({ status: "unsupported", missing: ["Bộ dựng không phản hồi"] });
  });

  it("reset thu hồi url bản đã dựng và về idle; giữ unsupported", async () => {
    const a = setup();
    await a.ctrl.start();
    a.ctrl.reset();
    expect(a.revoked).toEqual(["blob:0"]);
    expect(a.ctrl.state).toEqual({ status: "idle" });
    const b = setup({ support: async () => ({ ok: false, missing: ["VideoEncoder"] }) });
    await b.ctrl.checkSupport();
    b.ctrl.reset();
    expect(b.ctrl.state).toEqual({ status: "unsupported", missing: ["VideoEncoder"] });
  });

  it("reset khi lỗi thì về idle", async () => {
    const { ctrl } = setup({ build: async () => { throw new Error("x"); } });
    await ctrl.start();
    expect(ctrl.state.status).toBe("error");
    ctrl.reset();
    expect(ctrl.state).toEqual({ status: "idle" });
  });
});
