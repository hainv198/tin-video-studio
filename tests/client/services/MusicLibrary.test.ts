import { describe, expect, it, vi } from "vitest";
import { MusicLibrary } from "@/client/services/MusicLibrary";

/** fetch giả: manifest chính trả `body`, kho riêng trả `local` (mặc định 404 như khi không có file). */
function fakeFetch(body: unknown, local?: unknown) {
  return vi.fn(async (url: string) => {
    if (url === "/music/local/manifest.json") return local === undefined ? new Response("", { status: 404 }) : Response.json(local);
    return Response.json(body);
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const manifest = [
  { id: "ban-tin-mac-dinh", title: "Bản tin (mặc định)", file: "/music/ban-tin-mac-dinh.mp3", note: "tự soạn" },
  { id: "nhe-nhang", title: "Nhẹ nhàng", file: "/music/nhe-nhang.mp3" },
];

describe("MusicLibrary", () => {
  it("đọc manifest thành các MusicTrack của kho", async () => {
    const fetchImpl = fakeFetch(manifest);
    const tracks = await new MusicLibrary(fetchImpl).list();
    expect(tracks.map((t) => t.snapshot())).toEqual([
      { id: "ban-tin-mac-dinh", title: "Bản tin (mặc định)", origin: "library", uri: "/music/ban-tin-mac-dinh.mp3", gainOffsetDb: 0 },
      { id: "nhe-nhang", title: "Nhẹ nhàng", origin: "library", uri: "/music/nhe-nhang.mp3", gainOffsetDb: 0 },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith("/music/manifest.json");
  });

  it("chỉ tải một lần, các lần sau dùng bản đã lưu", async () => {
    const fetchImpl = fakeFetch(manifest);
    const lib = new MusicLibrary(fetchImpl);
    await lib.list();
    await lib.list();
    expect(fetchImpl).toHaveBeenCalledTimes(2); // manifest chính + kho riêng, mỗi cái một lần
  });

  it("tải lỗi thì báo tiếng Việt và lần sau thử lại được", async () => {
    let ok = false;
    const fetchImpl = vi.fn(async (url: string) =>
      url === "/music/local/manifest.json" ? new Response("", { status: 404 }) : ok ? Response.json(manifest) : new Response("", { status: 404 }),
    );
    const lib = new MusicLibrary(fetchImpl as unknown as typeof fetch);
    await expect(lib.list()).rejects.toThrow("Không tải được kho nhạc");
    ok = true;
    expect(await lib.list()).toHaveLength(2);
  });

  it("manifest sai định dạng thì báo lỗi", async () => {
    const bad = (body: unknown) => new MusicLibrary(fakeFetch(body)).list();
    await expect(bad({ không: "phải mảng" })).rejects.toThrow("Kho nhạc sai định dạng");
    await expect(bad([{ id: "x", title: "t", file: "khong-bat-dau-bang-gach" }])).rejects.toThrow("Kho nhạc sai định dạng");
    await expect(bad([{ id: "", title: "t", file: "/a.mp3" }])).rejects.toThrow("Kho nhạc sai định dạng");
  });

  it("kho rỗng là hợp lệ", async () => {
    expect(await new MusicLibrary(fakeFetch([])).list()).toEqual([]);
  });

  it("gộp thêm kho nhạc riêng trên máy; trùng id thì giữ bản của kho chính", async () => {
    const local = [
      { id: "conan", title: "Conan", file: "/music/local/conan.mp3" },
      { id: "nhe-nhang", title: "Trùng id", file: "/music/local/khac.mp3" },
    ];
    const tracks = await new MusicLibrary(fakeFetch(manifest, local)).list();
    expect(tracks.map((t) => t.id)).toEqual(["ban-tin-mac-dinh", "nhe-nhang", "conan"]);
    expect(tracks[1]?.snapshot().uri).toBe("/music/nhe-nhang.mp3");
  });

  it("kho riêng thiếu hoặc hỏng thì bỏ qua, không làm hỏng kho chính", async () => {
    expect(await new MusicLibrary(fakeFetch(manifest, { sai: "dinh dang" })).list()).toHaveLength(2);
    expect(await new MusicLibrary(fakeFetch(manifest)).list()).toHaveLength(2);
  });
});
