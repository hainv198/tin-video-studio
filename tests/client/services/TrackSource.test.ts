import { describe, expect, it } from "vitest";
import { ApiError } from "@/client/services/apiError";
import { TrackSource } from "@/client/services/TrackSource";
import { uploadUri } from "@/client/media/footageFactory";
import { MusicTrack } from "@/domain/MusicTrack";
import { memoryUploads } from "../../helpers/studioFixtures";

const lib = MusicTrack.create({ id: "m1", title: "M1", origin: "library", uri: "/music/m1.mp3" });

describe("TrackSource", () => {
  it("nhạc kho: tải từ uri và trả bytes", async () => {
    const { uploads } = memoryUploads();
    const fetchMock = async (url: RequestInfo | URL) => {
      expect(String(url)).toBe("/music/m1.mp3");
      return new Response(new Uint8Array([9, 8, 7]));
    };
    const source = new TrackSource(fetchMock as unknown as typeof fetch, uploads);
    expect(new Uint8Array(await source.bytes(lib))).toEqual(new Uint8Array([9, 8, 7]));
  });

  it("nhạc kho: uri không phải đường dẫn nội bộ bị từ chối, không gọi fetch", async () => {
    const { uploads } = memoryUploads();
    let calls = 0;
    const source = new TrackSource((async () => {
      calls += 1;
      return new Response("");
    }) as unknown as typeof fetch, uploads);
    for (const uri of ["https://evil.example/a.mp3", "//evil.example/a.mp3", "music/a.mp3"]) {
      const track = MusicTrack.create({ id: "x", title: "X", origin: "library", uri });
      await expect(source.blob(track)).rejects.toThrow("Nguồn nhạc không hợp lệ");
    }
    expect(calls).toBe(0);
  });

  it("nhạc kho: lỗi HTTP và hết phiên thành ApiError", async () => {
    const { uploads } = memoryUploads();
    const notFound = new TrackSource((async () => new Response("", { status: 404 })) as unknown as typeof fetch, uploads);
    const err = await notFound.blob(lib).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect([err.status, err.message]).toEqual([404, "Không tải được nhạc nền"]);

    const redirected = new Response("<html>", { status: 200 });
    Object.defineProperty(redirected, "redirected", { value: true });
    const expired = new TrackSource((async () => redirected) as unknown as typeof fetch, uploads);
    expect((await expired.blob(lib).catch((e) => e)).status).toBe(401);
  });

  it("nhạc tải lên: đọc từ kho tải lên; thiếu thì báo bằng tiếng Việt", async () => {
    const { uploads } = memoryUploads();
    const meta = await uploads.put(new Blob([new Uint8Array([1, 2])]), { name: "x.mp3", kind: "audio" });
    const source = new TrackSource((async () => new Response("")) as unknown as typeof fetch, uploads);
    const track = MusicTrack.create({ id: meta.id, title: "x", origin: "upload", uri: uploadUri(meta.id) });
    expect((await source.blob(track)).size).toBe(2);
    const missing = MusicTrack.create({ id: "u9", title: "y", origin: "upload", uri: uploadUri("upload-khong-co") });
    await expect(source.blob(missing)).rejects.toThrow("Không tìm thấy file nhạc đã tải lên, hãy chọn lại");
  });
});
