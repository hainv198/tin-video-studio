import { describe, expect, it } from "vitest";
import { SpeechChunker } from "@/client/media/SpeechChunker";

const sentence = (n: number) => `Câu số ${n} nói về tin tức hôm nay.`;

describe("SpeechChunker", () => {
  it("văn bản rỗng hoặc toàn khoảng trắng thì không có mẩu nào", () => {
    expect(new SpeechChunker().split("   \n  ")).toEqual([]);
  });

  it("gom tối đa 3 câu một mẩu, giữ nguyên thứ tự", () => {
    const text = [1, 2, 3, 4, 5, 6, 7].map(sentence).join(" ");
    const chunks = new SpeechChunker().split(text);
    expect(chunks).toEqual([
      [1, 2, 3].map(sentence).join(" "),
      [4, 5, 6].map(sentence).join(" "),
      sentence(7),
    ]);
  });

  it("không gộp câu của hai đoạn (xuống dòng) vào một mẩu", () => {
    expect(new SpeechChunker().split("Một. Hai.\n\nBa.")).toEqual(["Một. Hai.", "Ba."]);
  });

  it("mỗi mẩu không vượt giới hạn ký tự", () => {
    const long = (n: number) => `${"chữ ".repeat(500).trim()} số ${n}.`; // ~2000 ký tự
    const text = [1, 2, 3, 4].map(long).join(" ");
    const chunks = new SpeechChunker({ maxChars: 4500 }).split(text);
    expect(chunks).toHaveLength(2);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(4500);
    expect(chunks.join(" ")).toBe(text);
  });

  it("một câu dài hơn giới hạn bị cắt ở khoảng trắng, ghép lại đúng như cũ", () => {
    const words = Array.from({ length: 300 }, (_, i) => `từ${i}`);
    const text = `${words.join(" ")}.`;
    const chunks = new SpeechChunker({ maxChars: 200 }).split(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(200);
    expect(chunks.join(" ")).toBe(text);
  });

  it("từ không có khoảng trắng dài hơn giới hạn vẫn bị cắt cứng", () => {
    const chunks = new SpeechChunker({ maxChars: 10 }).split("a".repeat(25));
    expect(chunks).toEqual(["a".repeat(10), "a".repeat(10), "a".repeat(5)]);
  });
});
