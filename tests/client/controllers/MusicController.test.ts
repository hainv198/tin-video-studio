import { describe, expect, it } from "vitest";
import { MusicController } from "@/client/controllers/MusicController";
import type { MediaProbe } from "@/client/media/MediaProbe";
import { ApiError } from "@/client/services/apiError";
import { MusicTrack } from "@/domain/MusicTrack";
import { makeSessionWithProject, memoryUploads } from "../../helpers/studioFixtures";

const tracks = [
  MusicTrack.create({ id: "a", title: "Bản A", origin: "library", uri: "/music/a.mp3" }),
  MusicTrack.create({ id: "b", title: "Bản B", origin: "library", uri: "/music/b.mp3" }),
];

function setup(probe: Partial<MediaProbe> = {}, hold?: Promise<void>) {
  const made = makeSessionWithProject(1);
  const { uploads: rawUploads, store } = memoryUploads("m");
  const uploads = {
    put: async (...args: Parameters<typeof rawUploads.put>) => {
      const meta = await rawUploads.put(...args);
      if (hold) await hold;
      return meta;
    },
    delete: (id: string) => rawUploads.delete(id),
  };
  const fullProbe: MediaProbe = {
    image: async () => ({ width: 1, height: 1 }),
    video: async () => ({ width: 1, height: 1, durationSec: 1 }),
    audio: async () => ({ durationSec: 30 }),
    ...probe,
  };
  const trackSource = {
    blob: async (t: MusicTrack) => {
      if (t.id === "b") throw new ApiError(404, "TRACK", "Không tải được nhạc nền");
      return new Blob(["mp3"]);
    },
  };
  const ctrl = new MusicController({
    session: made.session,
    library: { list: async () => tracks },
    uploads,
    tracks: trackSource,
    probe: fullProbe,
  });
  return { ...made, ctrl, store, rawUploads };
}

const mp3 = (name = "nhac.mp3", size = 10) => new File([new Uint8Array(size)], name, { type: "audio/mpeg" });

describe("MusicController", () => {
  it("reset giữa lúc tải nhạc lên: file vừa lưu bị xoá, không chọn không thêm", async () => {
    let release!: () => void;
    const hold = new Promise<void>((r) => (release = r));
    const { ctrl, session, rawUploads } = setup({}, hold);
    const run = ctrl.uploadTrack(mp3());
    while ((await rawUploads.list()).length === 0) await new Promise((r) => setTimeout(r, 0));
    ctrl.reset();
    release();
    await run;
    expect(session.state.music).toBeNull();
    expect(ctrl.state.uploaded).toEqual([]);
    expect(await rawUploads.list()).toEqual([]);
    expect(ctrl.state.busy).toBe(false);
  });

  it("uploadTrack lần hai khi đang bận bị bỏ qua", async () => {
    let release!: () => void;
    const hold = new Promise<void>((r) => (release = r));
    const { ctrl, rawUploads } = setup({}, hold);
    const first = ctrl.uploadTrack(mp3("a.mp3"));
    await ctrl.uploadTrack(mp3("b.mp3"));
    release();
    await first;
    expect(ctrl.state.uploaded).toHaveLength(1);
    expect(await rawUploads.list()).toHaveLength(1);
  });

  it("loadLibrary nạp kho nhạc", async () => {
    const { ctrl } = setup();
    await ctrl.loadLibrary();
    expect(ctrl.state.library.map((t) => t.id)).toEqual(["a", "b"]);
    expect(ctrl.state.loading).toBe(false);
  });

  it("previewBlob trả Blob để nghe thử; lỗi thì null kèm thông báo", async () => {
    const { ctrl } = setup();
    expect(await ctrl.previewBlob(tracks[0]!)).toBeInstanceOf(Blob);
    expect(ctrl.state.error).toBeNull();
    expect(await ctrl.previewBlob(tracks[1]!)).toBeNull();
    expect(ctrl.state.error).toBe("Không tải được nhạc nền");
  });

  it("choose đặt nhạc nền và giữ mức chỉnh đã đặt; none bỏ nhạc", async () => {
    const { ctrl, session } = setup();
    ctrl.choose(tracks[0]!);
    ctrl.setGainOffset(3);
    ctrl.choose(tracks[1]!);
    expect(session.state.music?.id).toBe("b");
    expect(session.state.music?.gainOffsetDb).toBe(3);
    ctrl.none();
    expect(session.state.music).toBeNull();
  });

  it("setGainOffset ngoài ±6 dB báo lỗi và giữ giá trị cũ; chưa chọn nhạc cũng báo lỗi", () => {
    const { ctrl, session } = setup();
    ctrl.setGainOffset(2);
    expect(ctrl.state.error).toBe("Chưa chọn nhạc");
    ctrl.choose(tracks[0]!);
    ctrl.setGainOffset(7);
    expect(ctrl.state.error).toBe("Chỉnh âm lượng nhạc chỉ trong khoảng ±6 dB");
    expect(session.state.music?.gainOffsetDb).toBe(0);
    ctrl.setGainOffset(-6);
    expect(ctrl.state.error).toBeNull();
    expect(session.state.music?.levelBelowVoiceDb).toBe(21);
  });

  it("uploadTrack lưu file nhạc, tạo bản nhạc origin upload và tự chọn", async () => {
    const { ctrl, session, store } = setup();
    await ctrl.uploadTrack(mp3("Nhạc nền hay.mp3"));
    expect(session.state.music?.origin).toBe("upload");
    expect(session.state.music?.title).toBe("Nhạc nền hay");
    expect(session.state.music?.uri).toBe("upload:upload-m1");
    expect(ctrl.state.uploaded).toHaveLength(1);
    expect((await store.keys("blob:")).length).toBe(1);
  });

  it("từ chối file không phải nhạc hoặc quá 30 MB, không lưu", async () => {
    const { ctrl, store } = setup();
    await ctrl.uploadTrack(new File([new Uint8Array(5)], "a.jpg", { type: "image/jpeg" }));
    expect(ctrl.state.error).toBe("Không nhận file ảnh ở đây");
    await ctrl.uploadTrack(mp3("big.mp3", 30 * 1024 * 1024 + 1));
    expect(ctrl.state.error).toBe("File quá lớn (tối đa 30 MB cho nhạc)");
    expect(await store.keys("blob:")).toEqual([]);
  });

  it("file nhạc không giải mã được thì báo lỗi chung và không lưu", async () => {
    const { ctrl, session, store } = setup({
      audio: async () => {
        throw new DOMException("Unable to decode audio data", "EncodingError");
      },
    });
    await ctrl.uploadTrack(mp3());
    expect(ctrl.state.error).toBe("Có lỗi xảy ra, thử lại sau");
    expect(session.state.music).toBeNull();
    expect(await store.keys("blob:")).toEqual([]);
  });

  it("reset xoá nhạc đã tải lên và lỗi, giữ kho nhạc", async () => {
    const { ctrl } = setup();
    await ctrl.loadLibrary();
    await ctrl.uploadTrack(mp3());
    expect(ctrl.state.uploaded).toHaveLength(1);
    ctrl.reset();
    expect(ctrl.state.uploaded).toEqual([]);
    expect(ctrl.state.error).toBeNull();
    expect(ctrl.state.library).toHaveLength(2);
  });
});
