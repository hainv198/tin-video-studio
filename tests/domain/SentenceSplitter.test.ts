import { describe, expect, it } from "vitest";
import { SentenceSplitter } from "@/domain/SentenceSplitter";

const split = (t: string) => new SentenceSplitter().split(t);

describe("SentenceSplitter", () => {
  it("tách tại dấu chấm khi câu sau viết hoa", () => {
    expect(split("Câu một. Câu hai! Câu ba?")).toEqual(["Câu một.", "Câu hai!", "Câu ba?"]);
  });

  it("không tách số có dấu chấm ngăn cách", () => {
    expect(split("Bán 1.116,2 m2 đất. Thu hơn 545 triệu đồng.")).toEqual([
      "Bán 1.116,2 m2 đất.",
      "Thu hơn 545 triệu đồng.",
    ]);
    expect(split("Quy định tại khoản 3.357 Bộ luật Hình sự.")).toEqual([
      "Quy định tại khoản 3.357 Bộ luật Hình sự.",
    ]);
  });

  it("không tách sau chữ viết tắt", () => {
    expect(split("Vụ việc xảy ra ở TP. Hồ Chí Minh. Công an vào cuộc.")).toEqual([
      "Vụ việc xảy ra ở TP. Hồ Chí Minh.",
      "Công an vào cuộc.",
    ]);
  });

  it("không tách khi sau dấu chấm là chữ thường", () => {
    expect(split("Giá 5 tr. đồng mỗi tháng.")).toEqual(["Giá 5 tr. đồng mỗi tháng."]);
  });

  it("xuống dòng luôn là ranh giới câu", () => {
    expect(split("Phú Thọ: Khởi tố nguyên Chủ tịch xã\nCâu một. Câu hai.")).toEqual([
      "Phú Thọ: Khởi tố nguyên Chủ tịch xã",
      "Câu một.",
      "Câu hai.",
    ]);
  });

  it("giữ dấu ngoặc kép đóng trong câu", () => {
    expect(split('Ông hỏi: "Vì sao?" Rồi bỏ đi.')).toEqual(['Ông hỏi: "Vì sao?"', "Rồi bỏ đi."]);
  });

  it("gộp khoảng trắng thừa và bỏ câu rỗng", () => {
    expect(split("  Câu   một.\n\n\n  Câu hai.  ")).toEqual(["Câu một.", "Câu hai."]);
  });

  it("text rỗng trả về mảng rỗng", () => {
    expect(split("   \n ")).toEqual([]);
  });
});
