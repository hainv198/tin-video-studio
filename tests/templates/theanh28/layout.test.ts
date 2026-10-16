import { describe, expect, it } from "vitest";
import { coverRect, kenBurnsRect, LAYOUT, withAlpha, wrapText } from "@/templates/theanh28/layout";

describe("LAYOUT", () => {
  it("khung 1080×1920, dải ảnh thân bài 380→1300", () => {
    expect(LAYOUT.frame).toEqual({ width: 1080, height: 1920 });
    expect(LAYOUT.body.band).toEqual({ x: 0, y: 380, w: 1080, h: 920 });
    expect(LAYOUT.intro.image).toEqual({ x: 0, y: 0, w: 1080, h: 1000 });
  });
});

describe("coverRect", () => {
  it("ảnh ngang phủ kín dải, căn giữa", () => {
    const r = coverRect(1600, 900, { x: 0, y: 380, w: 1080, h: 920 });
    expect(r.h).toBeCloseTo(920, 6);
    expect(r.w).toBeCloseTo((1600 * 920) / 900, 6);
    expect(r.x).toBeCloseTo((1080 - r.w) / 2, 6);
    expect(r.y).toBeCloseTo(380, 6);
  });

  it("ảnh dọc phủ kín theo chiều ngang", () => {
    const r = coverRect(900, 1600, { x: 0, y: 0, w: 1080, h: 1000 });
    expect(r.w).toBeCloseTo(1080, 6);
    expect(r.y).toBeCloseTo((1000 - r.h) / 2, 6);
  });
});

describe("kenBurnsRect", () => {
  const base = { x: 0, y: 380, w: 1080, h: 920 };
  it("progress 0 giữ nguyên, 1 phóng 108% quanh tâm", () => {
    expect(kenBurnsRect(base, 0)).toEqual(base);
    const r = kenBurnsRect(base, 1);
    expect(r.w).toBeCloseTo(1080 * 1.08, 6);
    expect(r.x + r.w / 2).toBeCloseTo(540, 6);
    expect(r.y + r.h / 2).toBeCloseTo(380 + 460, 6);
  });
  it("kẹp progress ngoài 0..1", () => {
    expect(kenBurnsRect(base, -1)).toEqual(base);
    expect(kenBurnsRect(base, 2).w).toBeCloseTo(1080 * 1.08, 6);
  });
});

describe("wrapText", () => {
  const measure = (s: string) => s.length * 10;
  it("ngắt dòng tham lam theo từ", () => {
    expect(wrapText("AAA BBB CCC DDD", 75, measure, 3)).toEqual(["AAA BBB", "CCC DDD"]);
  });
  it("quá số dòng thì cắt và thêm dấu …", () => {
    expect(wrapText("AAA BBB CCC DDD EEE FFF", 75, measure, 2)).toEqual(["AAA BBB", "CCC…"]);
  });
  it("từ dài hơn khung vẫn đứng riêng một dòng", () => {
    expect(wrapText("AAAAAAAAAAAA BB", 75, measure, 3)).toEqual(["AAAAAAAAAAAA", "BB"]);
  });
  it("chuỗi rỗng ra mảng rỗng", () => {
    expect(wrapText("   ", 75, measure, 3)).toEqual([]);
  });
});

describe("withAlpha", () => {
  it("đổi #RRGGBB sang rgba", () => {
    expect(withAlpha("#1F9D55", 0.5)).toBe("rgba(31,157,85,0.5)");
  });
});

describe("LAYOUT.subtitle", () => {
  it("phụ đề nằm trong vùng an toàn TikTok, không đè dải ảnh, tem ngày, chip, tiêu đề, dòng nguồn", () => {
    const S = LAYOUT.subtitle;
    const bodyTop = S.bodyBottom - S.maxLines * S.lineHeight;
    expect(bodyTop).toBeGreaterThan(LAYOUT.body.band.y + LAYOUT.body.band.h);
    expect(bodyTop).toBeGreaterThan(LAYOUT.body.dateTag.y + LAYOUT.dateTag.h);
    expect(S.bodyBottom).toBeLessThanOrEqual(1600);
    const introTop = S.introBottom - S.maxLines * S.lineHeight;
    expect(S.introBottom).toBeLessThan(LAYOUT.intro.chip.y);
    expect(S.introBottom).toBeLessThan(LAYOUT.intro.title.y);
    expect(introTop).toBeGreaterThan(LAYOUT.credit.y + 2 * LAYOUT.credit.lineHeight);
    expect(S.centerX - S.maxWidth / 2).toBeGreaterThanOrEqual(120);
    expect(S.centerX + S.maxWidth / 2).toBeLessThanOrEqual(960);
  });
});
