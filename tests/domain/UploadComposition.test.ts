import { describe, expect, it } from "vitest";
import {
  DEFAULT_UPLOAD_COMPOSITION,
  isUploadComposition,
  titleOverlayOverrunSec,
  titleOverlayTooLongMessage,
  UPLOAD_COMPOSITION_LABELS,
  UPLOAD_COMPOSITIONS,
} from "@/domain/UploadComposition";

describe("UploadComposition", () => {
  it("hai cách ghép, mặc định giữ kiểu cũ, nhãn tiếng Việt", () => {
    expect(UPLOAD_COMPOSITIONS).toEqual(["intro-then-clip", "title-over-clip"]);
    expect(DEFAULT_UPLOAD_COMPOSITION).toBe("intro-then-clip");
    expect(UPLOAD_COMPOSITION_LABELS).toEqual({
      "intro-then-clip": "Thẻ tiêu đề rồi video",
      "title-over-clip": "Đọc tiêu đề đè trên video",
    });
    expect(isUploadComposition("title-over-clip")).toBe(true);
    expect(isUploadComposition("khac")).toBe(false);
    expect(isUploadComposition(undefined)).toBe(false);
  });

  it("độ vượt = nghỉ đầu + giọng − video (ms); vừa khít là 0", () => {
    expect(titleOverlayOverrunSec(0.3, 9, 8)).toBe(1.3);
    expect(titleOverlayOverrunSec(0.3, 7.7, 8)).toBeCloseTo(0, 9); // có thể là −0 do số thực; quy tắc dùng "> 0"
    expect(titleOverlayOverrunSec(0.3, 7.7, 8) > 0).toBe(false);
    expect(titleOverlayOverrunSec(0.3, 2, 8)).toBe(-5.7);
  });

  it("câu báo lỗi nêu số thật và cách xử lý", () => {
    expect(titleOverlayTooLongMessage(0.3, 9, 8)).toBe(
      "Giọng đọc tiêu đề (kể cả nghỉ đầu) dài 9,3 giây, video chỉ 8,0 giây. Hãy rút gọn tiêu đề, giảm nghỉ đầu, tăng tốc độ đọc hoặc chọn “Thẻ tiêu đề rồi video”.",
    );
  });
});
