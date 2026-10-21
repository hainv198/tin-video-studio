import { describe, expect, it, vi } from "vitest";
import { NOT_UPLOAD_PROJECT, SourceClipController, UNREADABLE_CLIP } from "@/client/controllers/SourceClipController";
import type { ClipInfo, SourceClipProbe } from "@/client/media/MediaProbe";
import { makeProject, makeSession, makeUploadProject, memoryUploads } from "../../helpers/studioFixtures";

const MB = 1024 * 1024;
const INFO: ClipInfo = { width: 1280, height: 720, durationSec: 8, hasAudio: true };
const mp4 = (name = "clip.mp4") => new File([new Uint8Array([1, 2, 3])], name, { type: "video/mp4" });

function setup(probe: SourceClipProbe = { clip: vi.fn(async () => INFO) }) {
  const made = makeSession();
  made.session.update((d) => ({ ...d, project: makeUploadProject() }));
  const { uploads } = memoryUploads("u");
  const ctrl = new SourceClipController({ session: made.session, uploads, probe });
  return { ...made, uploads, ctrl, probe };
}

describe("SourceClipController", () => {
  it("tải lên: lưu blob, ghi SourceClip vào session", async () => {
    const { ctrl, session, uploads } = setup();
    await ctrl.upload(mp4());
    const clip = session.state.sourceClip!;
    expect(clip.name).toBe("clip.mp4");
    expect(clip.durationSec).toBe(8);
    expect(clip.hasAudio).toBe(true);
    expect(clip.volumePercent).toBe(100);
    expect((await uploads.get(clip.uploadId))?.kind).toBe("video");
    expect(ctrl.state).toEqual({ busy: false, error: null });
  });

  it("quá 5 phút: báo lỗi, không lưu blob", async () => {
    const { ctrl, session, uploads } = setup({ clip: async () => ({ ...INFO, durationSec: 301 }) });
    await ctrl.upload(mp4());
    expect(ctrl.state.error).toBe("Video dài 5:01, tối đa 5 phút. Hãy cắt ngắn rồi tải lại.");
    expect(session.state.sourceClip).toBeNull();
    expect(await uploads.list()).toEqual([]);
  });

  it("quá 500 MB: báo lỗi trước khi đọc file", async () => {
    const probe = { clip: vi.fn(async () => INFO) };
    const { ctrl } = setup(probe);
    await ctrl.upload({ name: "to.mp4", type: "video/mp4", size: 501 * MB } as unknown as File);
    expect(ctrl.state.error).toBe("File quá lớn (tối đa 500 MB cho video)");
    expect(probe.clip).not.toHaveBeenCalled();
  });

  it("file không đọc được (lỗi thô của bộ đọc) thì báo tiếng Việt", async () => {
    const { ctrl } = setup({ clip: async () => { throw new Error("Unsupported codec hvc1"); } });
    await ctrl.upload(mp4());
    expect(ctrl.state.error).toBe(UNREADABLE_CLIP);
  });

  it("thay video: xoá blob cũ, giữ mức âm lượng đã chỉnh", async () => {
    const { ctrl, session, uploads } = setup();
    await ctrl.upload(mp4("a.mp4"));
    ctrl.setVolume(40);
    const first = session.state.sourceClip!.uploadId;
    await ctrl.upload(mp4("b.mp4"));
    const second = session.state.sourceClip!;
    expect(second.name).toBe("b.mp4");
    expect(second.volumePercent).toBe(40);
    expect(await uploads.get(first)).toBeNull();
    expect((await uploads.list()).map((m) => m.id)).toEqual([second.uploadId]);
  });

  it("chỉnh âm lượng: làm tròn bước 5; ngoài 0–150 thì báo lỗi", async () => {
    const { ctrl, session } = setup();
    ctrl.setVolume(50);
    expect(ctrl.state.error).toBe("Chưa tải video lên");
    await ctrl.upload(mp4());
    ctrl.setVolume(73);
    expect(session.state.sourceClip?.volumePercent).toBe(75);
    ctrl.setVolume(155);
    expect(ctrl.state.error).toBe("Âm lượng tiếng gốc chỉ từ 0 đến 150 %");
    expect(session.state.sourceClip?.volumePercent).toBe(75);
  });

  it("xoá video: bỏ khỏi session và xoá blob", async () => {
    const { ctrl, session, uploads } = setup();
    await ctrl.upload(mp4());
    await ctrl.remove();
    expect(session.state.sourceClip).toBeNull();
    expect(await uploads.list()).toEqual([]);
  });

  it("dự án kiểu tin hoặc chưa có dự án thì không nhận", async () => {
    const { ctrl, session } = setup();
    session.update((d) => ({ ...d, project: makeProject(2) }));
    await ctrl.upload(mp4());
    expect(ctrl.state.error).toBe(NOT_UPLOAD_PROJECT);
  });

  it("dự án mới giữa lúc đang tải: bỏ kết quả và xoá blob vừa lưu", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { ctrl, session, uploads } = setup({ clip: async () => { await gate; return INFO; } });
    const running = ctrl.upload(mp4());
    expect(ctrl.ingesting).toBe(true);
    ctrl.reset();
    release();
    await running;
    expect(session.state.sourceClip).toBeNull();
    expect(await uploads.list()).toEqual([]);
    expect(ctrl.ingesting).toBe(false);
  });

  it("blobFor trả blob đã lưu, không có thì null", async () => {
    const { ctrl, session } = setup();
    await ctrl.upload(mp4());
    expect(await ctrl.blobFor(session.state.sourceClip!.uploadId)).toBeInstanceOf(Blob);
    expect(await ctrl.blobFor("upload-khong-co")).toBeNull();
  });
});
