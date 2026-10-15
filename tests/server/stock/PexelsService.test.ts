import { describe, expect, it, vi } from "vitest";
import { PexelsService, pickPexelsFile } from "@/server/stock/PexelsService";

describe("PexelsService", () => {
  it("tìm ảnh: gửi key ở header, ánh xạ kết quả", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        photos: [
          {
            id: 11,
            width: 4000,
            height: 3000,
            url: "https://www.pexels.com/photo/11/",
            photographer: "An",
            src: { medium: "https://img/m.jpg", large2x: "https://img/l2.jpg", original: "https://img/o.jpg" },
          },
        ],
      }),
    );
    const items = await new PexelsService("PK", fetchImpl as unknown as typeof fetch).search({
      query: "police",
      kind: "image",
      page: 1,
      perPage: 8,
    });
    expect(items).toEqual([
      {
        provider: "pexels",
        id: "pexels-photo-11",
        kind: "image",
        thumbUrl: "https://img/m.jpg",
        fullUrl: "https://img/l2.jpg",
        width: 4000,
        height: 3000,
        author: "An",
        pageUrl: "https://www.pexels.com/photo/11/",
      },
    ]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.pexels.com/v1/search?query=police&page=1&per_page=8");
    expect(init.headers).toEqual({ Authorization: "PK" });
  });

  it("tìm video: chọn file mp4 lớn nhất không quá 1920, bỏ video không có file dùng được", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        videos: [
          {
            id: 5,
            width: 3840,
            height: 2160,
            url: "https://www.pexels.com/video/5/",
            image: "https://img/v5.jpg",
            duration: 12,
            user: { name: "Bình" },
            video_files: [
              { link: "https://v/4k.mp4", file_type: "video/mp4", width: 3840, height: 2160, quality: "uhd" },
              { link: "https://v/hd.mp4", file_type: "video/mp4", width: 1920, height: 1080, quality: "hd" },
              { link: "https://v/sd.mp4", file_type: "video/mp4", width: 960, height: 540, quality: "sd" },
            ],
          },
          { id: 6, width: 1, height: 1, url: "u", image: "i", duration: 3, user: { name: "C" }, video_files: [] },
        ],
      }),
    );
    const items = await new PexelsService("PK", fetchImpl as unknown as typeof fetch).search({
      query: "city",
      kind: "video",
      page: 2,
      perPage: 5,
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "pexels-video-5", fullUrl: "https://v/hd.mp4", width: 1920, durationSec: 12 });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(
      "https://api.pexels.com/videos/search?query=city&page=2&per_page=5",
    );
  });

  it("pickPexelsFile trả undefined khi không có mp4", () => {
    expect(pickPexelsFile([{ link: "x", file_type: "video/webm", width: 10, height: 10, quality: null }])).toBeUndefined();
  });
});
