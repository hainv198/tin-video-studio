import { VideoOptions } from "@/domain/VideoOptions";
import { frameStyleFor } from "@/templates/fonts/FontCatalog";
import { describe, expect, it } from "vitest";
import { BrandKit } from "@/domain/BrandKit";
import { TheAnh28Template } from "@/templates/theanh28/TheAnh28Template";
import { LAYOUT } from "@/templates/theanh28/layout";
import { SOURCE_CLIP_MEDIA, type DrawableImage, type ProjectFrame, type SceneFrame } from "@/templates/VideoTemplate";
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
    expect(t.brandFields.map((f) => f.key)).toEqual(["channelName", "primaryColor", "logo", "titleFontPx"]);
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

describe("TheAnh28Template — cỡ chữ tiêu đề mở đầu", () => {
  const title = "Khởi tố nguyên Chủ tịch UBND xã vì lạm quyền, tự ý bán trụ sở";
  const titleLines = (px: string | undefined) => {
    const brand = BrandKit.create("theanh28", t.brandFields, { channelName: "28 News", titleFontPx: px });
    const c = draw(project({ displayTitle: title, brand }), scene({ role: "intro" }));
    const font = `800 ${px ?? "64"}px`;
    return c.ops("fillText").filter((x) => x.state.font.startsWith(font));
  };

  it("mặc định 64px ngắt 3 dòng", () => {
    expect(titleLines(undefined)).toHaveLength(3);
  });

  it("52px ngắt 2 dòng, dùng đúng cỡ chữ và giãn dòng theo tỉ lệ", () => {
    const calls = titleLines("52");
    expect(calls).toHaveLength(2);
    expect((calls[1]!.args[2] as number) - (calls[0]!.args[2] as number)).toBe(Math.round(52 * (78 / 64)));
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

  it("đoạn dùng tiếp: zoom theo thời gian cảnh trám (footageTime/footageDuration), không reset ở đầu đoạn", () => {
    const bandWidth = (s: SceneFrame) => Number(draw(project(), s).ops("drawImage").filter((x) => x.args[0] === image.source)[1]?.args[3]);
    const startOfGroup = bandWidth(scene({ sceneTime: 0, sceneDuration: 2, footageTime: 0, footageDuration: 4 }));
    const midGroup = bandWidth(scene({ sceneTime: 0, sceneDuration: 2, footageTime: 2, footageDuration: 4 }));
    const endGroup = bandWidth(scene({ sceneTime: 2, sceneDuration: 2, footageTime: 4, footageDuration: 4 }));
    expect(midGroup / startOfGroup).toBeCloseTo(1.04, 6);
    expect(endGroup / startOfGroup).toBeCloseTo(1.08, 6);
    expect(bandWidth(scene({ sceneTime: 2, sceneDuration: 4, footageTime: 2, footageDuration: 4 }))).toBeCloseTo(
      bandWidth(scene({ sceneTime: 2, sceneDuration: 4 })),
      9,
    );
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

describe("TheAnh28Template — dòng nguồn tin dài", () => {
  const longCredit = Array.from({ length: 40 }, (_, i) => `Báo${i}`).join(" ");
  const creditText = (c: ReturnType<typeof draw>) =>
    String(c.ops("fillText").find((x) => String(x.args[0]).startsWith("THEO:"))?.args[0]);

  it("cảnh thân bài: cắt bằng dấu … và không chạm logo góc phải", () => {
    // tên kênh "28 NEWS" (7 ký tự × 46 × 0,5 = 161 px) → chữ bắt đầu x=823, huy hiệu x=745 → vùng cho phép 745 − 24 − 110 = 611 px
    const text = creditText(draw(project({ sourceCredit: longCredit }), scene()));
    expect(text.endsWith("…")).toBe(true);
    expect(text.length * 13).toBeLessThanOrEqual(611);
    expect(text.length * 13).toBeGreaterThan(611 - 100);
  });

  it("cảnh mở đầu: rộng hơn (không có logo góc phải), tối đa 930 px", () => {
    const text = creditText(draw(project({ sourceCredit: longCredit }), scene({ role: "intro" })));
    expect(text.endsWith("…")).toBe(true);
    expect(text.length * 13).toBeLessThanOrEqual(930);
    expect(text.length * 13).toBeGreaterThan(930 - 100);
  });

  it("nguồn tin ngắn giữ nguyên, dòng ẢNH: TỔNG HỢP không bị đổi", () => {
    const c = draw(project(), scene());
    expect(creditText(c)).toBe("THEO: ĐỨC PHONG - VIETNAMNET");
    expect(c.texts()).toContain("ẢNH: TỔNG HỢP");
  });
});

describe("TheAnh28Template — font chữ theo tuỳ chọn video", () => {
  it("không có style: mọi chữ vẫn là Barlow Condensed như cũ", () => {
    const c = draw(project(), scene({ role: "intro" }));
    expect(c.ops("fillText").every((x) => x.state.font.includes('"TVS Barlow Condensed"'))).toBe(true);
    const body = draw(project(), scene({ role: "body" }));
    expect(body.ops("fillText").every((x) => x.state.font.includes('"TVS Barlow Condensed"'))).toBe(true);
  });

  it("style chọn Oswald: tiêu đề, chip, tem ngày, dòng nguồn đều dùng Oswald với mức đậm của họ font", () => {
    const style = frameStyleFor(VideoOptions.defaults().withTextFont("oswald").withSubtitlesEnabled(false).snapshot());
    const c = draw(project({ style }), scene({ role: "intro" }));
    const fonts = c.ops("fillText").map((x) => x.state.font);
    expect(fonts.every((f) => f.includes('"TVS Oswald"'))).toBe(true);
    expect(fonts.some((f) => f.startsWith("700 64px"))).toBe(true); // tiêu đề: đậm nhất của Oswald là 700
    expect(fonts.some((f) => f.startsWith("600 26px"))).toBe(true); // dòng nguồn, tem ngày
    const body = draw(project({ style }), scene({ role: "body" }));
    expect(body.ops("fillText").every((x) => x.state.font.includes('"TVS Oswald"'))).toBe(true);
  });
});

describe("TheAnh28Template — màu thumbnail đầu", () => {
  const introStyle = (bg: string | null, block: string | null) =>
    frameStyleFor(VideoOptions.defaults().withSubtitlesEnabled(false).withIntroBackground(bg).withIntroBlock(block).snapshot());
  const fills = (c: RecordingCanvas) => c.ops("fillRect");
  const solidBlock = (c: RecordingCanvas) => fills(c).find((x) => x.args[1] === LAYOUT.intro.gradientSolid);
  const gradientStops = (c: RecordingCanvas) =>
    (fills(c).find((x) => x.args[1] === LAYOUT.intro.gradientTop)?.state.fillStyle as { stops: [number, string][] }).stops;

  it("không đặt màu: nền, dải chuyển, khối đều theo màu chủ đạo (như cũ)", () => {
    const c = draw(project(), scene({ role: "intro" }));
    expect(fills(c)[0]?.state.fillStyle).toBe("#1F9D55");
    expect(fills(c)[0]?.args).toEqual([0, 0, 1080, 1920]);
    expect(solidBlock(c)?.state.fillStyle).toBe("#1F9D55");
    expect(gradientStops(c)).toEqual([
      [0, "rgba(31,157,85,0)"],
      [1, "#1F9D55"],
    ]);
  });

  it("đặt cả hai màu: nền dùng màu nền, dải chuyển và khối sau tiêu đề dùng màu khối; chip vẫn màu chủ đạo", () => {
    const c = draw(project({ style: introStyle("#112233", "#445566") }), scene({ role: "intro" }));
    expect(fills(c)[0]?.state.fillStyle).toBe("#112233");
    expect(solidBlock(c)?.state.fillStyle).toBe("#445566");
    expect(gradientStops(c)).toEqual([
      [0, "rgba(68,85,102,0)"],
      [1, "#445566"],
    ]);
    expect(c.ops("fill").some((x) => x.state.fillStyle === "#1F9D55")).toBe(true); // chip tên kênh
  });

  it("chỉ đặt màu nền: khối sau tiêu đề vẫn theo màu chủ đạo", () => {
    const c = draw(project({ style: introStyle("#112233", null) }), scene({ role: "intro" }));
    expect(fills(c)[0]?.state.fillStyle).toBe("#112233");
    expect(solidBlock(c)?.state.fillStyle).toBe("#1F9D55");
  });

  it("cảnh thân bài không đổi theo màu thumbnail", () => {
    const plain = draw(project(), scene({ role: "body", image: null }));
    const styled = draw(project({ style: introStyle("#112233", "#445566") }), scene({ role: "body", image: null }));
    const stops = (c: RecordingCanvas) => (fills(c)[0]?.state.fillStyle as { stops: [number, string][] }).stops;
    expect(stops(styled)).toEqual(stops(plain));
  });
});

describe("TheAnh28Template — phụ đề", () => {
  const subtitleStyle = (enabled = true) => frameStyleFor(VideoOptions.defaults().withSubtitlesEnabled(enabled).snapshot());
  const subtitleTexts = (c: RecordingCanvas) => c.ops("fillText").filter((x) => x.state.font.includes('"TVS Phudu"'));
  const S = LAYOUT.subtitle;

  it("bật: câu ngắn vẽ giữa khung, đáy vùng phụ đề cảnh thân bài, viền đen trước rồi chữ trắng", () => {
    const c = draw(project({ style: subtitleStyle() }), scene({ text: "Câu tin." }));
    const fills = subtitleTexts(c);
    expect(fills.map((x) => x.args)).toEqual([["Câu tin.", 540, S.bodyBottom - S.lineHeight]]);
    expect(fills[0]?.state.font.startsWith("800 54px")).toBe(true);
    expect(fills[0]?.state.fillStyle).toBe("#FFFFFF");
    expect(c.ops("strokeText").map((x) => x.args)).toEqual([["Câu tin.", 540, S.bodyBottom - S.lineHeight]]);
    const strokeAt = c.calls.findIndex((x) => x.op === "strokeText");
    const fillAt = c.calls.findIndex((x) => x.op === "fillText" && x.args[0] === "Câu tin.");
    expect(strokeAt).toBeLessThan(fillAt);
  });

  it("tắt phụ đề hoặc không có style: không vẽ phụ đề", () => {
    for (const p of [project({ style: subtitleStyle(false) }), project()]) {
      const c = draw(p, scene({ text: "Câu tin." }));
      expect(c.ops("strokeText")).toHaveLength(0);
      expect(c.texts()).not.toContain("Câu tin.");
    }
  });

  it("cảnh mở đầu: phụ đề nằm trên chip tên kênh, không đè tiêu đề", () => {
    const c = draw(project({ style: subtitleStyle() }), scene({ role: "intro", text: "Tiêu đề ngắn." }));
    const y = subtitleTexts(c)[0]?.args[2] as number;
    expect(y).toBe(S.introBottom - S.lineHeight);
    expect(y + S.lineHeight).toBeLessThan(LAYOUT.intro.chip.y);
  });

  it("câu dài: chia đoạn ≤ 2 dòng và đổi đoạn theo thời gian giọng đọc (thuần theo sceneTime)", () => {
    const text = Array.from({ length: 24 }, (_, i) => `tu${String(i).padStart(2, "0")}`).join(" ");
    const at = (sceneTime: number) =>
      subtitleTexts(
        draw(project({ style: subtitleStyle() }), scene({ text, sceneTime, sceneDuration: 4.35, voiceStart: 0, voiceDuration: 4 })),
      ).map((x) => [String(x.args[0]), x.args[2]]);
    expect(at(0)).toEqual([
      ["tu00 tu01 tu02 tu03 tu04 tu05", S.bodyBottom - 2 * S.lineHeight],
      ["tu06 tu07 tu08 tu09 tu10 tu11", S.bodyBottom - S.lineHeight],
    ]);
    expect(at(2.5).map(([line]) => line)).toEqual(["tu12 tu13 tu14 tu15 tu16 tu17", "tu18 tu19 tu20 tu21 tu22 tu23"]);
    expect(at(4.3)).toEqual(at(2.5));
    expect(at(0)).toEqual(at(0)); // cùng đầu vào ra cùng hình (cache không đổi kết quả)
  });
});

describe("TheAnh28Template — video tải lên", () => {
  const bandImageCalls = (c: RecordingCanvas) =>
    c.ops("drawImage").filter((x) => x.args[0] === image.source && x.args.length === 5 && x.state.filter === "none");

  it("media contain + không chuyển động: video vừa dải thân bài, không zoom theo thời gian", () => {
    const early = bandImageCalls(draw(project(), scene({ media: SOURCE_CLIP_MEDIA, sceneTime: 0 })));
    const late = bandImageCalls(draw(project(), scene({ media: SOURCE_CLIP_MEDIA, sceneTime: 3.9 })));
    expect(early.at(-1)?.args.slice(1)).toEqual([0, 536.25, 1080, 607.5]);
    expect(late.at(-1)?.args.slice(1)).toEqual([0, 536.25, 1080, 607.5]);
  });

  it("không có media: vẫn cover + Ken Burns như cũ", () => {
    const calls = bandImageCalls(draw(project(), scene({ sceneTime: 0 })));
    const w = calls.at(-1)?.args[3] as number;
    expect(w).toBeGreaterThan(1080);
  });

  it("mediaCredit thay dòng 'ẢNH: TỔNG HỢP'; bỏ trống giữ như cũ", () => {
    expect(draw(project({ mediaCredit: "VIDEO: TỔNG HỢP" }), scene()).texts()).toContain("VIDEO: TỔNG HỢP");
    expect(draw(project({ mediaCredit: "VIDEO: TỔNG HỢP" }), scene()).texts()).not.toContain("ẢNH: TỔNG HỢP");
    expect(draw(project(), scene()).texts()).toContain("ẢNH: TỔNG HỢP");
  });
});
