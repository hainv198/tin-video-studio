import { describe, expect, it } from "vitest";
import { BrandKit } from "@/domain/BrandKit";
import { TheAnh28Template } from "@/templates/theanh28/TheAnh28Template";
import type { DrawableImage, ProjectFrame, SceneFrame } from "@/templates/VideoTemplate";
import { RecordingCanvas } from "../../helpers/RecordingCanvas";

const t = new TheAnh28Template();
const image: DrawableImage = { source: { tag: "img" } as unknown as CanvasImageSource, width: 1600, height: 900 };
const project = (over: Partial<ProjectFrame> = {}): ProjectFrame => ({
  displayTitle: "Phú Thọ: Khởi tố nguyên Chủ tịch UBND xã vì lạm quyền, tự ý bán trụ sở làm việc",
  sourceCredit: "Đức Phong - VietNamNet",
  publishDateText: "14/10/2026",
  brand: BrandKit.create("theanh28", t.brandFields, { channelName: "28 News" }),
  logo: null,
  ...over,
});
const scene = (over: Partial<SceneFrame> = {}): SceneFrame => ({
  role: "body",
  text: "Câu tin.",
  image,
  sceneTime: 0,
  sceneDuration: 4,
  ...over,
});
const draw = (p: ProjectFrame, s: SceneFrame) => {
  const c = new RecordingCanvas();
  t.drawFrame(c.asCanvas(), p, s);
  return c;
};

describe("TheAnh28Template — khai báo", () => {
  it("id, trường thương hiệu, mặc định, font", () => {
    expect(t.id).toBe("theanh28");
    expect(t.brandFields.map((f) => f.key)).toEqual(["channelName", "primaryColor", "logo"]);
    expect(t.defaults).toMatchObject({ width: 1080, height: 1920, fps: 30, fallbackKeyword: "news" });
    expect(t.fonts.map((f) => f.url)).toEqual([
      "/templates/theanh28/fonts/BarlowCondensed-SemiBold.ttf",
      "/templates/theanh28/fonts/BarlowCondensed-ExtraBold.ttf",
    ]);
  });

  it("bộ thương hiệu mặc định dùng được", () => {
    const kit = BrandKit.create("theanh28", t.brandFields, {});
    expect(kit.get("channelName")).toBe("TIN NHANH");
    expect(kit.get("primaryColor")).toBe("#1F9D55");
  });
});

describe("TheAnh28Template — cảnh mở đầu", () => {
  const c = draw(project(), scene({ role: "intro" }));

  it("tiêu đề in hoa, ngắt dòng, cỡ 64px đậm 800", () => {
    const titleCalls = c.ops("fillText").filter((x) => x.state.font.startsWith("800 64px"));
    expect(titleCalls.length).toBeGreaterThanOrEqual(2);
    expect(titleCalls.map((x) => String(x.args[0])).join(" ")).toBe(
      "PHÚ THỌ: KHỞI TỐ NGUYÊN CHỦ TỊCH UBND XÃ VÌ LẠM QUYỀN, TỰ Ý BÁN TRỤ SỞ LÀM VIỆC",
    );
  });

  it("có chip tên kênh, tem ngày đăng, dòng nguồn tin", () => {
    expect(c.texts()).toEqual(
      expect.arrayContaining(["28 NEWS", "NGÀY ĐĂNG: 14/10/2026", "THEO: ĐỨC PHONG - VIETNAMNET", "ẢNH: TỔNG HỢP"]),
    );
  });

  it("vẽ ảnh vào nửa trên và có dải chuyển màu chủ đạo", () => {
    expect(c.ops("drawImage").some((x) => x.args[0] === image.source)).toBe(true);
    expect(c.ops("createLinearGradient")).toHaveLength(1);
  });
});

describe("TheAnh28Template — cảnh thân bài", () => {
  it("nền mờ + ảnh rõ trong dải, có logo kênh góc phải, không vẽ tiêu đề", () => {
    const c = draw(project(), scene());
    const images = c.ops("drawImage").filter((x) => x.args[0] === image.source);
    expect(images).toHaveLength(2);
    expect(images[0]?.state.filter).toBe("blur(48px)");
    expect(images[1]?.state.filter).toBe("none");
    expect(c.texts()).toEqual(expect.arrayContaining(["28 NEWS", "NGÀY ĐĂNG: 14/10/2026"]));
    expect(c.ops("fillText").some((x) => x.state.font.startsWith("800 64px"))).toBe(false);
  });

  it("zoom chậm: cuối cảnh ảnh trong dải to hơn đầu cảnh 8%", () => {
    const widthAt = (sceneTime: number) => {
      const c = draw(project(), scene({ sceneTime }));
      const band = c.ops("drawImage").filter((x) => x.args[0] === image.source)[1];
      return Number(band?.args[3]);
    };
    expect(widthAt(4) / widthAt(0)).toBeCloseTo(1.08, 6);
  });

  it("không có cảnh trám: không vẽ ảnh, vẫn tô nền", () => {
    const c = draw(project(), scene({ image: null }));
    expect(c.ops("drawImage")).toHaveLength(0);
    expect(c.ops("fillRect").length).toBeGreaterThan(0);
  });

  it("có logo thì vẽ logo, nguồn tin rỗng thì bỏ dòng THEO", () => {
    const logo: DrawableImage = { source: { tag: "logo" } as unknown as CanvasImageSource, width: 200, height: 200 };
    const c = draw(project({ logo, sourceCredit: "" }), scene());
    expect(c.ops("drawImage").some((x) => x.args[0] === logo.source)).toBe(true);
    expect(c.texts().some((s) => s.startsWith("THEO:"))).toBe(false);
    expect(c.texts()).toContain("ẢNH: TỔNG HỢP");
  });

  it("thuần theo thời gian: cùng đầu vào ra cùng chuỗi lệnh", () => {
    const a = draw(project(), scene({ sceneTime: 1.5 }));
    const b = draw(project(), scene({ sceneTime: 1.5 }));
    expect(JSON.stringify(a.calls)).toBe(JSON.stringify(b.calls));
  });
});

describe("TheAnh28Template — nền mờ chuẩn bị sẵn", () => {
  const backdrop: DrawableImage = { source: { tag: "backdrop" } as unknown as CanvasImageSource, width: 135, height: 240 };

  it("có backdrop: phóng nền nhỏ ra toàn khung với nội suy cao, không dùng ctx.filter", () => {
    const c = draw(project(), scene({ backdrop }));
    const calls = c.ops("drawImage");
    expect(calls[0]?.args.slice(0, 5)).toEqual([backdrop.source, 0, 0, 1080, 1920]);
    expect(calls[0]?.state.imageSmoothingQuality).toBe("high");
    expect(c.calls.every((x) => !x.state.filter.startsWith("blur"))).toBe(true);
    // ảnh rõ trong dải vẫn được vẽ sau nền
    expect(calls.some((x) => x.args[0] === image.source)).toBe(true);
  });

  it("không có backdrop: giữ cách cũ (blur 48px) để tương thích", () => {
    const c = draw(project(), scene());
    expect(c.ops("drawImage")[0]?.state.filter).toBe("blur(48px)");
  });
});
