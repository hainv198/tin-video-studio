import { describe, expect, it } from "vitest";
import { SourceClip, SOURCE_CLIP_VOLUME } from "@/domain/SourceClip";
import { ValidationError } from "@/domain/errors";

const props = { uploadId: "upload-1", name: "clip.mp4", width: 1280, height: 720, durationSec: 8, hasAudio: true };

describe("SourceClip", () => {
  it("tạo với âm lượng mặc định 100 %, hệ số 1, ảnh thẻ đầu ở giây 1", () => {
    const c = SourceClip.create(props);
    expect(c.volumePercent).toBe(SOURCE_CLIP_VOLUME.default);
    expect(c.gain).toBe(1);
    expect(c.thumbnailSec).toBe(1);
    expect(SourceClip.create({ ...props, durationSec: 1.2 }).thumbnailSec).toBeCloseTo(0.6, 9);
  });

  it("không có tiếng gốc thì hệ số 0 dù âm lượng 100 %", () => {
    expect(SourceClip.create({ ...props, hasAudio: false }).gain).toBe(0);
  });

  it("chặn dữ liệu sai và video quá 5 phút (dung sai 0,5 s)", () => {
    expect(() => SourceClip.create({ ...props, uploadId: "" })).toThrow("Video tải lên thiếu mã file");
    expect(() => SourceClip.create({ ...props, width: 0 })).toThrow("Kích thước video không hợp lệ");
    expect(() => SourceClip.create({ ...props, durationSec: Number.NaN })).toThrow("Độ dài video không hợp lệ");
    expect(SourceClip.create({ ...props, durationSec: 300.4 }).durationSec).toBe(300.4);
    expect(() => SourceClip.create({ ...props, durationSec: 300.6 })).toThrow("Video dài quá 5 phút");
    expect(() => SourceClip.create({ ...props, volumePercent: 151 })).toThrow(ValidationError);
    expect(() => SourceClip.create({ ...props, volumePercent: 12.5 })).toThrow("Âm lượng tiếng gốc chỉ từ 0 đến 150 %");
  });

  it("withVolume làm tròn về bước 5 và giữ các trường khác", () => {
    const c = SourceClip.create(props).withVolume(52);
    expect(c.volumePercent).toBe(50);
    expect(c.gain).toBeCloseTo(0.5, 9);
    expect(c.uploadId).toBe("upload-1");
    expect(SourceClip.create(props).withVolume(0).gain).toBe(0);
    expect(() => SourceClip.create(props).withVolume(160)).toThrow(ValidationError);
  });

  it("tên rỗng thành 'video'", () => {
    expect(SourceClip.create({ ...props, name: "  " }).name).toBe("video");
  });

  it("snapshot/restore khứ hồi; thiếu âm lượng dùng mặc định; hỏng thì ném", () => {
    const c = SourceClip.create({ ...props, volumePercent: 75 });
    expect(SourceClip.restore(c.snapshot()).snapshot()).toEqual({ ...props, volumePercent: 75 });
    const { volumePercent: _v, ...old } = c.snapshot();
    expect(SourceClip.restore(old as never).volumePercent).toBe(100);
    expect(() => SourceClip.restore(null as never)).toThrow("Bản nháp hỏng: dữ liệu video tải lên không hợp lệ");
    expect(() => SourceClip.restore({ ...props, hasAudio: "có" } as never)).toThrow("Bản nháp hỏng: thông tin video tải lên không hợp lệ");
  });
});
