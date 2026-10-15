import { describe, expect, it, vi } from "vitest";
import { RenderController } from "@/client/controllers/RenderController";
import { ApiError } from "@/client/services/apiError";
import { RenderCancelledError } from "@/client/render/errors";
import type { RenderJob } from "@/client/render/RenderJob";
import { makeSessionWithProject } from "../../helpers/studioFixtures";

const job = { templateId: "theanh28" } as unknown as RenderJob;

function setup(opts: {
  build?: (data: unknown, onProgress?: unknown, isCancelled?: unknown, options?: unknown) => Promise<{ job: RenderJob; warnings: string[] }>;
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
      quality: "standard",
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
    expect(failing.ctrl.state).toEqual({ status: "error", message: "Lỗi bộ dựng: không rõ", quality: "standard" });

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
    expect(ctrl.state).toEqual({ status: "idle", quality: "standard" });
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
    expect(ctrl.state).toEqual({ status: "unsupported", missing: ["VideoEncoder"], quality: "standard" });
    await ctrl.start();
    expect(ctrl.state.status).toBe("unsupported");
  });

  it("worker thiếu khả năng hoặc không phản hồi cũng khoá bước dựng", async () => {
    const missing = setup({ probeWorker: async () => ["Canvas 2D trong worker"] });
    await missing.ctrl.checkSupport();
    expect(missing.ctrl.state).toEqual({ status: "unsupported", missing: ["Canvas 2D trong worker"], quality: "standard" });

    const silent = setup({ probeWorker: async () => { throw new Error("Bộ dựng không phản hồi"); } });
    await silent.ctrl.checkSupport();
    expect(silent.ctrl.state).toEqual({ status: "unsupported", missing: ["Bộ dựng không phản hồi"], quality: "standard" });
  });

  it("reset thu hồi url bản đã dựng và về idle; giữ unsupported", async () => {
    const a = setup();
    await a.ctrl.start();
    a.ctrl.reset();
    expect(a.revoked).toEqual(["blob:0"]);
    expect(a.ctrl.state).toEqual({ status: "idle", quality: "standard" });
    const b = setup({ support: async () => ({ ok: false, missing: ["VideoEncoder"] }) });
    await b.ctrl.checkSupport();
    b.ctrl.reset();
    expect(b.ctrl.state).toEqual({ status: "unsupported", missing: ["VideoEncoder"], quality: "standard" });
  });

  function gate() {
    let release!: () => void;
    const promise = new Promise<void>((r) => (release = r));
    return { promise, release };
  }

  it("markStale khi đang dựng thì bản dựng xong được đánh dấu cũ", async () => {
    const g = gate();
    const { ctrl } = setup({
      render: async () => {
        await g.promise;
        return { blob: new Blob(["mp4"]), durationSec: 1 };
      },
    });
    const run = ctrl.start();
    ctrl.markStale();
    g.release();
    await run;
    expect(ctrl.state).toMatchObject({ status: "done", stale: true });
    await ctrl.start();
    expect(ctrl.state).toMatchObject({ status: "done", stale: false });
  });

  it("reset giữa lúc dựng: kết quả về sau bị bỏ, trạng thái giữ idle", async () => {
    const g = gate();
    const ok = setup({
      render: async () => {
        await g.promise;
        return { blob: new Blob(["mp4"]), durationSec: 1 };
      },
    });
    const run = ok.ctrl.start();
    await new Promise((r) => setTimeout(r, 0));
    ok.ctrl.reset();
    g.release();
    await run;
    expect(ok.ctrl.state).toEqual({ status: "idle", quality: "standard" });
    expect(ok.urls).toEqual([]);

    const g2 = gate();
    const bad = setup({
      render: async () => {
        await g2.promise;
        throw new Error("hỏng muộn");
      },
    });
    const run2 = bad.ctrl.start();
    await new Promise((r) => setTimeout(r, 0));
    bad.ctrl.reset();
    g2.release();
    await run2;
    expect(bad.ctrl.state).toEqual({ status: "idle", quality: "standard" });
  });

  it("checkSupport: kết quả không hỗ trợ về muộn không đè lên trạng thái đang dùng", async () => {
    const g = gate();
    const { ctrl } = setup({
      support: async () => {
        await g.promise;
        return { ok: false, missing: ["VideoEncoder"] };
      },
    });
    const check = ctrl.checkSupport();
    await ctrl.start();
    g.release();
    await check;
    expect(ctrl.state.status).toBe("done");
  });

  it("huỷ ngay trước khi tạo url thì không tạo url", async () => {
    let ctrlRef: RenderController | null = null;
    const made = setup({
      render: async () => {
        ctrlRef!.cancel();
        return { blob: new Blob(["mp4"]), durationSec: 1 };
      },
    });
    ctrlRef = made.ctrl;
    await made.ctrl.start();
    expect(made.ctrl.state).toEqual({ status: "idle", quality: "standard" });
    expect(made.urls).toEqual([]);
  });

  it("reset khi lỗi thì về idle", async () => {
    const { ctrl } = setup({ build: async () => { throw new Error("x"); } });
    await ctrl.start();
    expect(ctrl.state.status).toBe("error");
    ctrl.reset();
    expect(ctrl.state).toEqual({ status: "idle", quality: "standard" });
  });

  it("setQuality(light): lượt dựng sau truyền bitrate 5 Mbps cho bộ dựng; mặc định 8 Mbps", async () => {
    const calls: unknown[] = [];
    const build = vi.fn(async (_d: unknown, _p: unknown, _c: unknown, options?: unknown) => {
      calls.push(options);
      return { job, warnings: [] };
    });
    const { ctrl } = setup({ build });
    await ctrl.start();
    ctrl.setQuality("light");
    expect(ctrl.state.quality).toBe("light");
    await ctrl.start();
    expect(calls).toEqual([{ videoBitrate: 8_000_000 }, { videoBitrate: 5_000_000 }]);
    expect(ctrl.state).toMatchObject({ status: "done", quality: "light" });
  });

  it("setQuality khi đã dựng xong: giữ video nhưng đánh dấu cũ; reset giữ lựa chọn", async () => {
    const { ctrl } = setup();
    await ctrl.start();
    ctrl.setQuality("light");
    expect(ctrl.state).toMatchObject({ status: "done", stale: true, quality: "light" });
    ctrl.reset();
    expect(ctrl.state).toEqual({ status: "idle", quality: "light" });
  });

  it("setQuality khi đang dựng thì bị bỏ qua", async () => {
    const g = gate();
    const { ctrl } = setup({
      render: async () => {
        await g.promise;
        return { blob: new Blob(["mp4"]), durationSec: 1 };
      },
    });
    const run = ctrl.start();
    ctrl.setQuality("light");
    expect(ctrl.state.quality).toBe("standard");
    g.release();
    await run;
    expect(ctrl.state).toMatchObject({ status: "done", quality: "standard", stale: false });
  });
});
