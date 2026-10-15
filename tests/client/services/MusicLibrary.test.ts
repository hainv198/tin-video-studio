import { describe, expect, it, vi } from "vitest";
import { MusicLibrary } from "@/client/services/MusicLibrary";

const manifest = [
  { id: "ban-tin-mac-dinh", title: "Bản tin (mặc định)", file: "/music/ban-tin-mac-dinh.mp3", note: "tự soạn" },
  { id: "nhe-nhang", title: "Nhẹ nhàng", file: "/music/nhe-nhang.mp3" },
];

describe("MusicLibrary", () => {
  it("đọc manifest thành các MusicTrack của kho", async () => {
    const fetchImpl = vi.fn(async () => Response.json(manifest));
    const tracks = await new MusicLibrary(fetchImpl as unknown as typeof fetch).list();
    expect(tracks.map((t) => t.snapshot())).toEqual([
      { id: "ban-tin-mac-dinh", title: "Bản tin (mặc định)", origin: "library", uri: "/music/ban-tin-mac-dinh.mp3", gainOffsetDb: 0 },
      { id: "nhe-nhang", title: "Nhẹ nhàng", origin: "library", uri: "/music/nhe-nhang.mp3", gainOffsetDb: 0 },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith("/music/manifest.json");
  });

  it("chỉ tải một lần, các lần sau dùng bản đã lưu", async () => {
    const fetchImpl = vi.fn(async () => Response.json(manifest));
    const lib = new MusicLibrary(fetchImpl as unknown as typeof fetch);
    await lib.list();
    await lib.list();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("tải lỗi thì báo tiếng Việt và lần sau thử lại được", async () => {
    let ok = false;
    const fetchImpl = vi.fn(async () => (ok ? Response.json(manifest) : new Response("", { status: 404 })));
    const lib = new MusicLibrary(fetchImpl as unknown as typeof fetch);
    await expect(lib.list()).rejects.toThrow("Không tải được kho nhạc");
    ok = true;
    expect(await lib.list()).toHaveLength(2);
  });

  it("manifest sai định dạng thì báo lỗi", async () => {
    const bad = (body: unknown) => new MusicLibrary((async () => Response.json(body)) as unknown as typeof fetch).list();
    await expect(bad({ không: "phải mảng" })).rejects.toThrow("Kho nhạc sai định dạng");
    await expect(bad([{ id: "x", title: "t", file: "khong-bat-dau-bang-gach" }])).rejects.toThrow("Kho nhạc sai định dạng");
    await expect(bad([{ id: "", title: "t", file: "/a.mp3" }])).rejects.toThrow("Kho nhạc sai định dạng");
  });

  it("kho rỗng là hợp lệ", async () => {
    expect(await new MusicLibrary((async () => Response.json([])) as unknown as typeof fetch).list()).toEqual([]);
  });
});
