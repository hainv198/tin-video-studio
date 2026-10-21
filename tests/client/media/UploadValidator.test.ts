import { describe, expect, it } from "vitest";
import { checkSourceClipDuration, classifySourceClip, classifyUpload, formatClock, SOURCE_CLIP_LIMITS, UPLOAD_LIMITS } from "@/client/media/UploadValidator";
import { ValidationError } from "@/domain/errors";

const MB = 1024 * 1024;
const file = (name: string, type: string, size = 1000) => ({ name, type, size });

describe("classifyUpload", () => {
  it("nhận ảnh, video, nhạc theo MIME", () => {
    expect(classifyUpload(file("a.jpg", "image/jpeg"))).toBe("image");
    expect(classifyUpload(file("a.png", "image/png"))).toBe("image");
    expect(classifyUpload(file("a.webp", "image/webp"))).toBe("image");
    expect(classifyUpload(file("a.mp4", "video/mp4"))).toBe("video");
    expect(classifyUpload(file("a.webm", "video/webm"))).toBe("video");
    expect(classifyUpload(file("a.mov", "video/quicktime"))).toBe("video");
    expect(classifyUpload(file("a.mp3", "audio/mpeg"))).toBe("audio");
    expect(classifyUpload(file("a.wav", "audio/wav"))).toBe("audio");
    expect(classifyUpload(file("a.m4a", "audio/x-m4a"))).toBe("audio");
  });

  it("MIME trống hoặc lạ thì dựa vào đuôi file, không phân biệt hoa thường", () => {
    expect(classifyUpload(file("ANH.JPEG", ""))).toBe("image");
    expect(classifyUpload(file("clip.MOV", "application/octet-stream"))).toBe("video");
    expect(classifyUpload(file("nhac.M4A", ""))).toBe("audio");
  });

  it("từ chối định dạng không hỗ trợ", () => {
    expect(() => classifyUpload(file("a.gif", "image/gif"))).toThrow("Định dạng không được hỗ trợ: gif");
    expect(() => classifyUpload(file("a.txt", "text/plain"))).toThrow(ValidationError);
    expect(() => classifyUpload(file("khong-duoi", ""))).toThrow("Định dạng không được hỗ trợ");
  });

  it("từ chối file rỗng", () => {
    expect(() => classifyUpload(file("a.jpg", "image/jpeg", 0))).toThrow("File rỗng");
  });

  it("giới hạn dung lượng theo loại: ảnh 20 MB, video 300 MB, nhạc 30 MB", () => {
    expect(UPLOAD_LIMITS).toEqual({ image: 20 * MB, video: 300 * MB, audio: 30 * MB });
    expect(classifyUpload(file("a.jpg", "image/jpeg", 20 * MB))).toBe("image");
    expect(() => classifyUpload(file("a.jpg", "image/jpeg", 20 * MB + 1))).toThrow("File quá lớn (tối đa 20 MB cho ảnh)");
    expect(() => classifyUpload(file("a.mp4", "video/mp4", 300 * MB + 1))).toThrow("tối đa 300 MB cho video");
    expect(() => classifyUpload(file("a.mp3", "audio/mpeg", 30 * MB + 1))).toThrow("tối đa 30 MB cho nhạc");
  });

  it("chỉ nhận loại được phép", () => {
    expect(() => classifyUpload(file("a.mp3", "audio/mpeg"), ["image", "video"])).toThrow("Không nhận file nhạc ở đây");
    expect(classifyUpload(file("a.mp4", "video/mp4"), ["image", "video"])).toBe("video");
  });
});

describe("video tải lên (kiểu Video tải lên)", () => {
  it("nhận MP4/MOV/WebM tới 500 MB; giới hạn cảnh trám 300 MB giữ nguyên", () => {
    expect(classifySourceClip(file("a.mp4", "video/mp4", 500 * MB))).toBe("video");
    expect(classifySourceClip(file("a.MOV", "", 10 * MB))).toBe("video");
    expect(() => classifySourceClip(file("a.mp4", "video/mp4", 500 * MB + 1))).toThrow("File quá lớn (tối đa 500 MB cho video)");
    expect(() => classifyUpload(file("a.mp4", "video/mp4", 300 * MB + 1))).toThrow("File quá lớn (tối đa 300 MB cho video)");
    expect(SOURCE_CLIP_LIMITS).toEqual({ maxBytes: 500 * MB, maxDurationSec: 300 });
  });

  it("chỉ nhận video", () => {
    expect(() => classifySourceClip(file("a.jpg", "image/jpeg"))).toThrow("Không nhận file ảnh ở đây");
    expect(() => classifySourceClip(file("a.mp3", "audio/mpeg"))).toThrow("Không nhận file nhạc ở đây");
  });

  it("thời lượng tối đa 5:00 (dung sai 0,5 s), báo theo phút:giây", () => {
    expect(() => checkSourceClipDuration(300.4)).not.toThrow();
    expect(() => checkSourceClipDuration(301)).toThrow("Video dài 5:01, tối đa 5 phút. Hãy cắt ngắn rồi tải lại.");
    expect(() => checkSourceClipDuration(0)).toThrow("Không đọc được độ dài video");
    expect(() => checkSourceClipDuration(Number.NaN)).toThrow("Không đọc được độ dài video");
  });

  it("formatClock", () => {
    expect(formatClock(8)).toBe("0:08");
    expect(formatClock(65.4)).toBe("1:05");
    expect(formatClock(300)).toBe("5:00");
  });
});
