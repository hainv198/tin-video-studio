import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { createStudio } from "@/client/controllers/createStudio";
import { createClientServices, type ClientEnv } from "@/client/container";
import { SAMPLE_NEWS } from "@/client/sample/sampleNews";
import { ApiError } from "@/client/services/apiError";

function env(): ClientEnv {
  return {
    fetch: (async () => new Response("", { status: 404 })) as unknown as typeof fetch,
    indexedDB: new IDBFactory() as unknown as IDBFactory,
    origin: "http://localhost:3100",
    createUrl: () => "blob:x",
    revokeUrl: () => {},
  };
}

describe("createStudio", () => {
  it("lắp đủ controller dùng chung một session", async () => {
    const studio = createStudio(createClientServices(env()), { schedule: () => () => {} });
    expect(studio.project.createFrom({ ...SAMPLE_NEWS, templateId: "theanh28" })).toBe(true);
    expect(studio.session.state.project?.scenes.length).toBeGreaterThan(2);
    expect(studio.wizard.next()).toBe(true);
    expect(studio.wizard.state.step).toBe("voice");
    await studio.brand.load("theanh28");
    expect(studio.session.state.brand.values.channelName).toBe("TIN NHANH");
    studio.dispose();
  });

  it("onAuthLost của studio được gọi khi một controller gặp lỗi hết phiên", async () => {
    let lost = 0;
    const services = createClientServices(env());
    (services.tts as unknown as { voices: () => Promise<never> }).voices = async () => {
      throw new ApiError(401, "AUTH", "Chưa đăng nhập");
    };
    const studio = createStudio(services, { onAuthLost: () => lost++, schedule: () => () => {} });
    await studio.voice.loadVoices();
    expect(lost).toBe(1);
    studio.dispose();
  });

  it("mỗi lần session đổi dữ liệu thì render.markStale được gọi", () => {
    const studio = createStudio(createClientServices(env()), { schedule: () => () => {} });
    const spy = vi.spyOn(studio.render, "markStale");
    studio.session.update((d) => ({ ...d }));
    expect(spy).toHaveBeenCalled();
    studio.dispose();
  });

  it("discard khi đang tải nhiều file không xoá file đã lưu của lượt tải", async () => {
    const services = createClientServices(env());
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    (services.probe as unknown as { image: () => Promise<unknown> }).image = async () => {
      calls += 1;
      if (calls === 2) await gate;
      return { width: 10, height: 10 };
    };
    const studio = createStudio(services, { schedule: () => () => {} });
    studio.project.createFrom({ ...SAMPLE_NEWS, templateId: "theanh28" });
    const file = (n: string) => new File([new Uint8Array(10)], n, { type: "image/jpeg" });
    const run = studio.footage.addFiles([file("a.jpg"), file("b.jpg")]);
    while (calls < 2) await new Promise((r) => setTimeout(r, 0));
    while ((await services.uploads.list()).length < 1) await new Promise((r) => setTimeout(r, 0));
    expect((await services.uploads.list()).length).toBe(1);
    await studio.wizard.discard();
    expect((await services.uploads.list()).length).toBe(1);
    release();
    await run;
    studio.dispose();
  });

  it("discard không xoá nhạc đã tải lên nhưng chưa được chọn", async () => {
    const services = createClientServices(env());
    (services.probe as unknown as { audio: () => Promise<unknown> }).audio = async () => ({ durationSec: 30 });
    const studio = createStudio(services, { schedule: () => () => {} });
    await studio.music.uploadTrack(new File([new Uint8Array(10)], "n.mp3", { type: "audio/mpeg" }));
    studio.music.none();
    expect((await services.uploads.list()).length).toBe(1);
    await studio.wizard.discard();
    expect((await services.uploads.list()).length).toBe(1);
    studio.dispose();
  });

  it("lỗi lưu bản nháp hiện thành thông báo trên wizard", async () => {
    const services = createClientServices(env());
    (services.drafts as unknown as { save: () => Promise<never> }).save = async () => {
      throw new Error("QuotaExceeded");
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const studio = createStudio(services, { schedule: () => () => {} });
    studio.project.createFrom({ ...SAMPLE_NEWS, templateId: "theanh28" });
    await studio.session.flush();
    expect(studio.wizard.state.error).toBe("Không lưu được bản nháp (bộ nhớ trình duyệt đầy hoặc bị chặn)");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    studio.dispose();
  });

  it("newProject làm sạch kho file và dựng lại của dự án cũ", async () => {
    const studio = createStudio(createClientServices(env()), { schedule: () => () => {} });
    studio.project.createFrom({ ...SAMPLE_NEWS, templateId: "theanh28" });
    await studio.wizard.newProject();
    expect(studio.session.state.project).toBeNull();
    expect(studio.footage.pool()).toEqual([]);
    expect(studio.render.state.status).toBe("idle");
    expect(studio.search.state.byScene).toEqual({});
    studio.dispose();
  });

  it("có OptionsController dùng chung session", () => {
    const studio = createStudio(createClientServices(env()), { schedule: () => () => {} });
    studio.options.setTextFont("oswald");
    expect(studio.session.state.options.textFontId).toBe("oswald");
    studio.dispose();
  });

  it("lắp SourceClipController; dự án mới dọn blob video tải lên", async () => {
    const services = createClientServices(env());
    (services.probe as unknown as { clip: () => Promise<unknown> }).clip = async () => ({ width: 640, height: 360, durationSec: 5, hasAudio: false });
    const studio = createStudio(services, { schedule: () => () => {} });
    expect(studio.project.setKind("upload")).toBe(true);
    expect(studio.project.createTitleOnlyFromForm({ title: "Clip", sourceCredit: "", publishDateText: "2026-10-21", templateId: "theanh28" })).toBe(true);
    await studio.clip.upload(new File([new Uint8Array([1])], "c.mp4", { type: "video/mp4" }));
    expect(studio.session.state.sourceClip?.hasAudio).toBe(false);
    expect(await services.uploads.list()).toHaveLength(1);
    await studio.wizard.newProject();
    expect(studio.session.state.sourceClip).toBeNull();
    expect(await services.uploads.list()).toEqual([]);
    studio.dispose();
  });
});
