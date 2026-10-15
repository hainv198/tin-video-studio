import { describe, expect, it, vi } from "vitest";
import { PixabayService } from "@/server/stock/PixabayService";

describe("PixabayService", () => {
  it("tìm ảnh: key ở query, per_page tối thiểu 3 rồi cắt lại", async () => {
    const hit = (id: number) => ({
      id,
      pageURL: `https://pixabay.com/p/${id}`,
      webformatURL: `https://px/w${id}.jpg`,
      largeImageURL: `https://px/l${id}.jpg`,
      imageWidth: 1920,
      imageHeight: 1280,
      user: "Cường",
    });
    const fetchImpl = vi.fn(async () => Response.json({ hits: [hit(1), hit(2), hit(3)] }));
    const items = await new PixabayService("XK", fetchImpl as unknown as typeof fetch).search({
      query: "court gavel",
      kind: "image",
      page: 1,
      perPage: 2,
    });
    expect(items.map((i) => i.id)).toEqual(["pixabay-photo-1", "pixabay-photo-2"]);
    expect(items[0]).toMatchObject({ thumbUrl: "https://px/w1.jpg", fullUrl: "https://px/l1.jpg", author: "Cường" });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(
      "https://pixabay.com/api/?key=XK&q=court+gavel&page=1&per_page=3&safesearch=true&image_type=photo",
    );
  });

  it("tìm video: chọn bản lớn nhất không quá 1920", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        hits: [
          {
            id: 9,
            pageURL: "https://pixabay.com/v/9",
            duration: 15,
            user: "Dung",
            videos: {
              large: { url: "https://pv/l.mp4", width: 3840, height: 2160, thumbnail: "https://pv/l.jpg" },
              medium: { url: "https://pv/m.mp4", width: 1920, height: 1080, thumbnail: "https://pv/m.jpg" },
              small: { url: "https://pv/s.mp4", width: 1280, height: 720, thumbnail: "https://pv/s.jpg" },
            },
          },
        ],
      }),
    );
    const items = await new PixabayService("XK", fetchImpl as unknown as typeof fetch).search({
      query: "money",
      kind: "video",
      page: 1,
      perPage: 8,
    });
    expect(items[0]).toMatchObject({
      id: "pixabay-video-9",
      kind: "video",
      fullUrl: "https://pv/m.mp4",
      thumbUrl: "https://pv/m.jpg",
      width: 1920,
      durationSec: 15,
    });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(
      "https://pixabay.com/api/videos/?key=XK&q=money&page=1&per_page=8&safesearch=true",
    );
  });
});
