import { describe, expect, it } from "vitest";
import { FootageController } from "@/client/controllers/FootageController";
import type { MediaProbe } from "@/client/media/MediaProbe";
import { sequentialIds } from "@/domain/ids";
import { FallbackFootage, ImageFootage } from "@/domain/Footage";
import { uploadToFootage } from "@/client/media/footageFactory";
import { makeSession, makeSessionWithProject, memoryUploads } from "../../helpers/studioFixtures";

const probe: MediaProbe = {
  image: async () => ({ width: 1600, height: 900 }),
  video: async () => ({ width: 1920, height: 1080, durationSec: 12 }),
  audio: async () => ({ durationSec: 30 }),
};

const img = (name = "a.jpg") => new File([new Uint8Array(10)], name, { type: "image/jpeg" });
const vid = (name = "v.mp4") => new File([new Uint8Array(10)], name, { type: "video/mp4" });

function setup(bodyCount = 3) {
  const made = makeSessionWithProject(bodyCount); // s1 mở đầu, s2…
  const { uploads, store } = memoryUploads("u");
  const ctrl = new FootageController({ session: made.session, uploads, probe, ids: sequentialIds("f") });
  return { ...made, ctrl, uploads, store };
}

describe("FootageController", () => {
  it("addFiles lưu file và gán lần lượt vào các cảnh trống theo thứ tự", async () => {
    const { ctrl, session, store } = setup(3); // s1..s4
    await ctrl.addFiles([img("a.jpg"), img("b.jpg"), vid("c.mp4")]);
    const board = session.state.footage;
    expect(board.sceneIds()).toEqual(["s1", "s2", "s3"]);
    expect(board.get("s1")?.kind).toBe("image");
    expect(board.get("s3")?.kind).toBe("video");
    expect(board.get("s1")?.snapshot()).toMatchObject({ source: { origin: "upload", uri: "upload:upload-u1" } });
    expect(board.get("s3")?.snapshot()).toMatchObject({ kind: "video", durationSec: 12 });
    expect((await store.keys("blob:")).length).toBe(3);
    expect(ctrl.state.error).toBeNull();
    expect(ctrl.state.busy).toBe(false);
  });

  it("không ghi đè cảnh đã có cảnh trám; file thừa chỉ vào kho", async () => {
    const { ctrl, session } = setup(2); // s1..s3
    session.update((d) => ({ ...d, footage: d.footage.assign("s2", new FallbackFootage("keep")) }));
    await ctrl.addFiles([img("a.jpg"), img("b.jpg"), img("c.jpg")]);
    expect(session.state.footage.get("s2")?.id).toBe("keep");
    expect(session.state.footage.get("s1")?.snapshot()).toMatchObject({ source: { uri: "upload:upload-u1" } });
    expect(session.state.footage.get("s3")?.snapshot()).toMatchObject({ source: { uri: "upload:upload-u2" } });
    expect(ctrl.pool()).toHaveLength(3);
  });

  it("file lỗi không chặn file tốt, thông báo nêu tên file", async () => {
    const { ctrl, session } = setup(2);
    await ctrl.addFiles([new File(["x"], "bad.gif", { type: "image/gif" }), img("ok.jpg")]);
    expect(session.state.footage.sceneIds()).toEqual(["s1"]);
    expect(ctrl.state.error).toBe("bad.gif: Định dạng không được hỗ trợ: gif");
  });

  it("chặn file quá lớn trước khi lưu", async () => {
    const { ctrl, session, store } = setup(1);
    await ctrl.addFiles([new File([new Uint8Array(20 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" })]);
    expect(ctrl.state.error).toBe("big.jpg: File quá lớn (tối đa 20 MB cho ảnh)");
    expect(session.state.footage.sceneIds()).toEqual([]);
    expect(await store.keys("blob:")).toEqual([]);
  });

  it("replaceWithFile ghi đè đúng cảnh được chọn", async () => {
    const { ctrl, session } = setup(2);
    session.update((d) => ({ ...d, footage: d.footage.assign("s2", new FallbackFootage("old")) }));
    await ctrl.replaceWithFile("s2", vid("new.mp4"));
    expect(session.state.footage.get("s2")?.kind).toBe("video");
    expect(session.state.footage.get("s1")).toBeUndefined();
  });

  it("một file dùng cho nhiều cảnh qua assignFromPool", async () => {
    const { ctrl, session } = setup(2);
    await ctrl.addFiles([img("a.jpg")]);
    const footage = ctrl.pool()[0]!;
    ctrl.assignFromPool("s3", footage.id);
    expect(session.state.footage.get("s3")).toBe(footage);
    expect(session.state.footage.get("s1")).toBe(footage);
    ctrl.assignFromPool("s2", "khong-co");
    expect(ctrl.state.error).toBe("Không tìm thấy file trong danh sách đã tải lên");
  });

  it("pool gồm cả file tải lên đang nằm trong bảng cảnh trám (sau khi mở lại bản nháp)", async () => {
    const { ctrl, session } = setup(1);
    await ctrl.addFiles([img("a.jpg")]);
    const restored = new FootageController({
      session,
      uploads: memoryUploads("z").uploads,
      probe,
      ids: sequentialIds("g"),
    });
    expect(restored.pool().map((f) => f.id)).toEqual([session.state.footage.get("s1")!.id]);
  });

  it("unassign và swap", async () => {
    const { ctrl, session } = setup(2);
    await ctrl.addFiles([img("a.jpg"), vid("b.mp4")]);
    const [a, b] = [session.state.footage.get("s1"), session.state.footage.get("s2")];
    ctrl.swap("s1", "s2");
    expect(session.state.footage.get("s1")).toBe(b);
    expect(session.state.footage.get("s2")).toBe(a);
    ctrl.unassign("s1");
    expect(session.state.footage.get("s1")).toBeUndefined();
  });

  it("chưa có dự án thì báo lỗi", async () => {
    const made = makeSession();
    const ctrl = new FootageController({ session: made.session, uploads: memoryUploads().uploads, probe, ids: sequentialIds("f") });
    await ctrl.addFiles([img()]);
    expect(ctrl.state.error).toBe("Chưa có dự án");
  });

  it("previewSource: URL cho stock, Blob cho file tải lên, null cho nền mặc định hoặc file đã mất", async () => {
    const { ctrl, session } = setup(1);
    await ctrl.addFiles([img("a.jpg")]);
    const own = session.state.footage.get("s1");
    const blob = await ctrl.previewSource(own);
    expect(blob).toBeInstanceOf(Blob);
    expect((blob as Blob).size).toBe(10);
    const stock = new ImageFootage("st", { origin: "pexels", uri: "https://cdn/x.jpg" }, 10, 10);
    expect(await ctrl.previewSource(stock)).toBe("https://cdn/x.jpg");
    expect(await ctrl.previewSource(new FallbackFootage("fb"))).toBeNull();
    expect(await ctrl.previewSource(undefined)).toBeNull();
    const lost = uploadToFootage("g", "upload-khong-co", "image", { width: 10, height: 10 });
    expect(await ctrl.previewSource(lost)).toBeNull();
  });
});
