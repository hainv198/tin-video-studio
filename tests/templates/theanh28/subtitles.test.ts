import { describe, expect, it } from "vitest";
import { cueAt, splitSubtitle, timeCues } from "@/templates/theanh28/subtitles";

const measure = (s: string) => s.length * 10; // 10 px/ký tự
const TEXT = "aaa bbb cc ddd eee fff ggg hhh iiii jjjj kkkk lll";

describe("splitSubtitle", () => {
  it("ngắt dòng theo độ rộng đo được, gom mỗi đoạn ≤ 2 dòng", () => {
    expect(splitSubtitle(TEXT, 100, measure)).toEqual([
      ["aaa bbb cc", "ddd eee"],
      ["fff ggg", "hhh iiii"],
      ["jjjj kkkk", "lll"],
    ]);
  });

  it("câu ngắn là một đoạn một dòng; chuỗi trống không có đoạn nào", () => {
    expect(splitSubtitle("Câu tin.", 100, measure)).toEqual([["Câu tin."]]);
    expect(splitSubtitle("   ", 100, measure)).toEqual([]);
  });

  it("maxLines = 1 thì mỗi dòng là một đoạn", () => {
    expect(splitSubtitle("aaa bbb cc ddd eee", 100, measure, 1)).toEqual([["aaa bbb cc"], ["ddd eee"]]);
  });
});

describe("timeCues / cueAt", () => {
  const cues = timeCues(splitSubtitle(TEXT, 100, measure), 0.3, 4.7);

  it("chia thời lượng giọng đọc theo tỉ lệ số ký tự của từng đoạn", () => {
    // ký tự: 18, 16, 13 (tổng 47) trên 4,7 s ⇒ 0,1 s/ký tự
    expect(cues.map((c) => c.start)).toEqual([0.3, expect.closeTo(2.1, 9), expect.closeTo(3.7, 9)]);
    expect(cues.map((c) => c.end)).toEqual([expect.closeTo(2.1, 9), expect.closeTo(3.7, 9), expect.closeTo(5.0, 9)]);
  });

  it("trước giọng đọc hiện đoạn đầu, sau giọng đọc giữ đoạn cuối", () => {
    expect(cueAt(cues, 0)?.lines).toEqual(["aaa bbb cc", "ddd eee"]);
    expect(cueAt(cues, 2.0)?.lines).toEqual(["aaa bbb cc", "ddd eee"]);
    expect(cueAt(cues, 2.15)?.lines).toEqual(["fff ggg", "hhh iiii"]);
    expect(cueAt(cues, 4.9)?.lines).toEqual(["jjjj kkkk", "lll"]);
    expect(cueAt(cues, 5.6)?.lines).toEqual(["jjjj kkkk", "lll"]);
  });

  it("không có đoạn nào thì không có phụ đề", () => {
    expect(cueAt([], 1)).toBeNull();
  });
});
