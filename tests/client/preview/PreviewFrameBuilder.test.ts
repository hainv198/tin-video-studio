import { describe, expect, it } from "vitest";
import { buildPreviewFrames, PREVIEW_CHARS_PER_SEC, type PreviewForm } from "@/client/preview/PreviewFrameBuilder";
import { SAMPLE_NEWS } from "@/client/sample/sampleNews";
import { SentenceSplitter } from "@/domain/SentenceSplitter";
import { VideoOptions } from "@/domain/VideoOptions";
import { defaultTemplateRegistry } from "@/templates/registry";
import { TheAnh28Template } from "@/templates/theanh28/TheAnh28Template";
import type { DrawableImage } from "@/templates/VideoTemplate";
import { RecordingCanvas } from "../../helpers/RecordingCanvas";

const template = new TheAnh28Template();
const image: DrawableImage = { source: { tag: "placeholder" } as unknown as CanvasImageSource, width: 1600, height: 900 };
const form = (over: Partial<PreviewForm> = {}): PreviewForm => ({
  text: "",
  title: "",
  sourceCredit: "",
  publishDateText: "2026-10-17",
  templateId: "theanh28",
  ...over,
});
const build = (f: PreviewForm, options = VideoOptions.defaults(), brandValues: Record<string, string> = {}) =>
  buildPreviewFrames({ form: f, template, brandValues, options: options.snapshot(), logo: null, image, now: new Date(2026, 9, 17) });

const sampleSentences = new SentenceSplitter().split(SAMPLE_NEWS.text);

describe("buildPreviewFrames — nội dung", () => {
  it("chưa có nội dung: dùng tin mẫu (tiêu đề, câu thân bài, nguồn, ngày mẫu) và báo usingSample", () => {
    const f = build(form({ publishDateText: "" }));
    expect(f.usingSample).toBe(true);
    expect(f.intro.text).toBe(sampleSentences[0]);
    expect(f.project.displayTitle).toBe((sampleSentences[0] as string).replace(/\.$/, ""));
    expect(f.body.text).toBe(sampleSentences[1]);
    expect(f.project.sourceCredit).toBe(SAMPLE_NEWS.sourceCredit);
    expect(f.project.publishDateText).toBe("14/10/2026");
  });

  it("không gõ tiêu đề: tiêu đề rơi về câu đầu, phụ đề thân bài là câu thứ hai", () => {
    const f = build(form({ text: "Câu một rất hay. Câu hai tiếp theo. Câu ba.", sourceCredit: " Báo A ", publishDateText: "2026-01-05" }));
    expect(f.usingSample).toBe(false);
    expect(f.project.displayTitle).toBe("Câu một rất hay");
    expect(f.intro.text).toBe("Câu một rất hay.");
    expect(f.body.text).toBe("Câu hai tiếp theo.");
    expect(f.project.sourceCredit).toBe("Báo A");
    expect(f.project.publishDateText).toBe("05/01/2026");
  });

  it("có tiêu đề riêng: tiêu đề theo ô tiêu đề, phụ đề thân bài là câu đầu", () => {
    const f = build(form({ text: "Câu một. Câu hai.", title: "  Tin   nóng!  " }));
    expect(f.project.displayTitle).toBe("Tin nóng");
    expect(f.body.text).toBe("Câu một.");
  });

  it("chỉ có một câu: thân bài dùng lại câu đó; ngày sai thì lấy hôm nay", () => {
    const f = build(form({ text: "Một câu duy nhất.", publishDateText: "abc" }));
    expect(f.project.displayTitle).toBe("Một câu duy nhất");
    expect(f.body.text).toBe("Một câu duy nhất.");
    expect(f.project.publishDateText).toBe("17/10/2026");
  });
});

describe("buildPreviewFrames — tuỳ chọn và thương hiệu", () => {
  it("phụ đề bật/tắt và font theo tuỳ chọn", () => {
    const on = build(form(), VideoOptions.defaults().withSubtitleFont("oswald").withTextFont("montserrat"));
    expect(on.project.style?.subtitles).toEqual({ enabled: true, font: { family: "TVS Oswald", semiBold: 600, bold: 700 } });
    expect(on.project.style?.textFont.family).toBe("TVS Montserrat");
    const off = build(form(), VideoOptions.defaults().withSubtitlesEnabled(false));
    expect(off.project.style?.subtitles.enabled).toBe(false);
  });

  it("màu thumbnail đầu theo tuỳ chọn", () => {
    const f = build(form(), VideoOptions.defaults().withIntroBackground("#112233").withIntroBlock("#445566"));
    expect(f.project.style?.intro).toEqual({ backgroundColor: "#112233", blockColor: "#445566" });
  });

  it("thương hiệu theo giá trị hiện tại; giá trị sai thì về mặc định của phong cách", () => {
    expect(build(form(), undefined, { channelName: "Kênh A", primaryColor: "#123456" }).project.brand.get("channelName")).toBe("Kênh A");
    const bad = build(form(), undefined, { primaryColor: "đỏ" });
    expect(bad.project.brand.get("primaryColor")).toBe("#1F9D55");
  });

  it("mốc thời gian: mở đầu là khung đầu (giọng bắt đầu sau leadIn), thân bài ở giữa câu", () => {
    const options = VideoOptions.defaults().withLeadInSec(0.5).withGapSec(0.4);
    const f = build(form({ text: "Câu một. Câu hai dài hơn chút." }), options);
    const voice = Math.max(1, "Câu hai dài hơn chút.".length / PREVIEW_CHARS_PER_SEC);
    expect(f.intro).toMatchObject({ role: "intro", sceneTime: 0, footageTime: 0, voiceStart: 0.5, image });
    expect(f.body).toMatchObject({ role: "body", voiceStart: 0, voiceDuration: voice, sceneTime: voice / 2, sceneDuration: voice + 0.4 });
  });
});

describe("buildPreviewFrames — vẽ bằng template thật", () => {
  const draw = (frames: ReturnType<typeof build>, tab: "intro" | "body") => {
    const c = new RecordingCanvas();
    template.drawFrame(c.asCanvas(), frames.project, tab === "intro" ? frames.intro : frames.body);
    return c;
  };

  it("thumbnail đầu: nền màu riêng, tiêu đề in hoa đúng font chữ đã chọn", () => {
    const frames = build(form({ title: "Tin nóng" }), VideoOptions.defaults().withTextFont("montserrat").withIntroBackground("#112233"));
    const c = draw(frames, "intro");
    expect(c.ops("fillRect")[0]?.state.fillStyle).toBe("#112233");
    const title = c.ops("fillText").find((x) => x.args[0] === "TIN NÓNG");
    expect(title?.state.font).toBe('800 64px "TVS Montserrat", "Arial Narrow", sans-serif');
  });

  it("cảnh thân bài: phụ đề bật thì có viền chữ đúng font phụ đề, tắt thì không", () => {
    const text = "Câu một. Câu hai.";
    const on = draw(build(form({ text }), VideoOptions.defaults().withSubtitleFont("oswald")), "body");
    const stroke = on.ops("fillText").find((x) => x.args[0] === "Câu hai.");
    expect(stroke?.state.font).toBe('700 54px "TVS Oswald", "Arial Narrow", sans-serif');
    expect(on.ops("strokeText").length).toBeGreaterThan(0);
    const off = draw(build(form({ text }), VideoOptions.defaults().withSubtitlesEnabled(false)), "body");
    expect(off.ops("strokeText")).toHaveLength(0);
    expect(off.ops("drawImage").some((x) => x.args[0] === image.source)).toBe(true);
  });
});


describe("buildPreviewFrames — kiểu Video tải lên", () => {
  const base = {
    template,
    brandValues: {},
    options: VideoOptions.defaults().snapshot(),
    logo: null,
    image,
    now: new Date(2026, 9, 21),
  };
  const uploadForm = { text: "", title: "Clip hiện trường vụ cháy.", sourceCredit: "Báo A", publishDateText: "2026-10-21", templateId: "theanh28", kind: "upload" as const };

  it("tiêu đề lấy từ ô tiêu đề; thân bài là khung video vừa khung, không chữ, không phụ đề, credit VIDEO", () => {
    const f = buildPreviewFrames({ ...base, form: uploadForm });
    expect(f.usingSample).toBe(false);
    expect(f.project.displayTitle).toBe("Clip hiện trường vụ cháy");
    expect(f.project.mediaCredit).toBe("VIDEO: TỔNG HỢP");
    expect(f.project.style?.subtitles.enabled).toBe(false);
    expect(f.intro.text).toBe("Clip hiện trường vụ cháy.");
    expect(f.body.text).toBe("");
    expect(f.body.media).toEqual({ fit: "contain", motion: false });
    expect(f.body.image).toBe(base.image);
  });

  it("chưa gõ tiêu đề thì dùng tiêu đề mẫu và báo usingSample", () => {
    const f = buildPreviewFrames({ ...base, form: { ...uploadForm, title: " " } });
    expect(f.usingSample).toBe(true);
    expect(f.project.displayTitle.length).toBeGreaterThan(10);
  });

  it("kiểu tin (kind bỏ trống) giữ nguyên: không media, không mediaCredit", () => {
    const f = buildPreviewFrames({ ...base, form: { ...uploadForm, kind: undefined, text: "Câu một. Câu hai." } });
    expect(f.body.media).toBeUndefined();
    expect(f.project.mediaCredit).toBeUndefined();
  });

  it("khung video 9:16 gốc: thân bài phủ toàn khung (fullFrame), không zoom; cả hai cách ghép", () => {
    const tall: DrawableImage = { ...image, width: 1080, height: 1920 };
    const f = buildPreviewFrames({ ...base, image: tall, form: uploadForm });
    expect(f.body.media).toEqual({ fit: "fullFrame", motion: false });
    expect(f.intro.media).toBeUndefined(); // thẻ tiêu đề đầu giữ nguyên
    const over = buildPreviewFrames({
      ...base,
      image: tall,
      options: VideoOptions.defaults().withUploadComposition("title-over-clip").snapshot(),
      form: uploadForm,
    });
    expect(over.intro.media).toEqual({ fit: "fullFrame", motion: false });
    expect(over.body.media).toEqual({ fit: "fullFrame", motion: false });
  });

  it("khung video dọc không phải 9:16 (3:4) hoặc vuông: vừa khung (contain) trên nền mờ", () => {
    for (const [width, height] of [[1080, 1440], [1080, 1080]] as const) {
      const f = buildPreviewFrames({ ...base, image: { ...image, width, height }, form: uploadForm });
      expect(f.body.media).toEqual({ fit: "contain", motion: false });
    }
  });
});

describe("buildPreviewFrames — banner chân", () => {
  const banner: DrawableImage = { source: { tag: "banner" } as unknown as CanvasImageSource, width: 2048, height: 682 };
  const input = (kind: "news" | "upload", withBanner: boolean) => ({
    form: { text: "Câu một. Câu hai.", title: "Tiêu đề", sourceCredit: "A", publishDateText: "2026-10-17", templateId: "theanh28-banner", kind },
    template: defaultTemplateRegistry().get("theanh28-banner"),
    brandValues: {},
    options: VideoOptions.defaults().snapshot(),
    logo: null,
    image: null,
    ...(withBanner ? { banner } : {}),
  });

  it("có banner thì project.banner là ảnh đó ở cả hai kiểu video", () => {
    expect(buildPreviewFrames(input("news", true)).project.banner).toBe(banner);
    expect(buildPreviewFrames(input("upload", true)).project.banner).toBe(banner);
  });

  it("không có banner thì project không có khoá banner (khung cũ y hệt)", () => {
    expect("banner" in buildPreviewFrames(input("news", false)).project).toBe(false);
    expect("banner" in buildPreviewFrames(input("upload", false)).project).toBe(false);
  });
});

describe("buildPreviewFrames — đọc tiêu đề đè trên video", () => {
  const input = (overlay: boolean) => ({
    form: { text: "", title: "Tiêu đề thử", sourceCredit: "", publishDateText: "2026-10-17", templateId: "theanh28", kind: "upload" as const },
    template: defaultTemplateRegistry().get("theanh28"),
    brandValues: {},
    options: (overlay ? VideoOptions.defaults().withUploadComposition("title-over-clip") : VideoOptions.defaults()).snapshot(),
    logo: null,
    image: null,
  });

  it("tab đầu = khung video đang đọc tiêu đề; tab sau = đã thu gọn; cả hai là cảnh thân bài", () => {
    const f = buildPreviewFrames(input(true));
    // nghỉ đầu 0,3 + giọng ước lượng max(1, 11/15) = 1 + giữ 0,35
    expect(f.intro.titleOverlay?.collapseAtSec).toBeCloseTo(1.65, 9);
    expect(f.intro.role).toBe("body");
    expect(f.body.role).toBe("body");
    expect(f.intro.sceneTime).toBeLessThan(1.65);
    expect(f.intro.sceneTime).toBeGreaterThan(0.3);
    expect(f.body.sceneTime).toBeGreaterThanOrEqual(1.65 + 0.4);
    expect(f.body.titleOverlay).toEqual(f.intro.titleOverlay);
  });

  it("cách ghép mặc định: như cũ (thẻ đầu role intro, không có titleOverlay)", () => {
    const f = buildPreviewFrames(input(false));
    expect(f.intro.role).toBe("intro");
    expect("titleOverlay" in f.intro).toBe(false);
    expect("titleOverlay" in f.body).toBe(false);
  });
});
