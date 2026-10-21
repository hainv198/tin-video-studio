import { ValidationError } from "./errors";

export const SOURCE_CLIP_VOLUME = { min: 0, max: 150, step: 5, default: 100 } as const;

export interface SourceClipProps {
  uploadId: string;
  name: string;
  width: number;
  height: number;
  /** Giây, tính từ khung hình đầu. */
  durationSec: number;
  /** Có track âm mà trình duyệt giải mã được. */
  hasAudio: boolean;
  /** 0–150, bước 5; bỏ trống = 100 (giữ nguyên tiếng gốc). */
  volumePercent?: number;
}

export interface SourceClipSnapshot {
  uploadId: string;
  name: string;
  width: number;
  height: number;
  durationSec: number;
  hasAudio: boolean;
  volumePercent: number;
}

/** Video người dùng tải lên cho kiểu "Video tải lên". Bất biến; blob nằm ở UploadRepository theo `uploadId`. */
export class SourceClip {
  /** 5 phút: bộ nhớ âm thanh và MP4 đầu ra đều nằm trong RAM của tab (xem kế hoạch 06, §G2). */
  static readonly MAX_DURATION_SEC = 300;
  /** Sai số đo độ dài (khung cuối, mốc âm) cho phép vượt nhẹ 5:00. */
  static readonly DURATION_TOLERANCE_SEC = 0.5;

  private constructor(
    readonly uploadId: string,
    readonly name: string,
    readonly width: number,
    readonly height: number,
    readonly durationSec: number,
    readonly hasAudio: boolean,
    readonly volumePercent: number,
  ) {}

  static create(p: SourceClipProps): SourceClip {
    if (!p.uploadId) throw new ValidationError("Video tải lên thiếu mã file");
    if (!Number.isFinite(p.width) || !Number.isFinite(p.height) || p.width <= 0 || p.height <= 0) {
      throw new ValidationError("Kích thước video không hợp lệ");
    }
    if (!Number.isFinite(p.durationSec) || p.durationSec <= 0) throw new ValidationError("Độ dài video không hợp lệ");
    if (p.durationSec > SourceClip.MAX_DURATION_SEC + SourceClip.DURATION_TOLERANCE_SEC) {
      throw new ValidationError("Video dài quá 5 phút");
    }
    const volume = p.volumePercent ?? SOURCE_CLIP_VOLUME.default;
    if (!Number.isInteger(volume) || volume < SOURCE_CLIP_VOLUME.min || volume > SOURCE_CLIP_VOLUME.max) {
      throw new ValidationError("Âm lượng tiếng gốc chỉ từ 0 đến 150 %");
    }
    return new SourceClip(p.uploadId, p.name.trim() || "video", p.width, p.height, p.durationSec, p.hasAudio, volume);
  }

  /** Hệ số tuyến tính cho tiếng gốc khi trộn (0 = tắt). */
  get gain(): number {
    return this.hasAudio ? this.volumePercent / 100 : 0;
  }

  /** Giây (tính từ khung đầu) lấy ảnh cho thẻ tiêu đề: tránh khung đen đầu video nhưng không quá giữa clip ngắn. */
  get thumbnailSec(): number {
    return Math.min(1, this.durationSec / 2);
  }

  withVolume(percent: number): SourceClip {
    const step = SOURCE_CLIP_VOLUME.step;
    const rounded = Number.isFinite(percent) ? Math.round(percent / step) * step : Number.NaN;
    return SourceClip.create({ ...this.snapshot(), volumePercent: rounded });
  }

  snapshot(): SourceClipSnapshot {
    return {
      uploadId: this.uploadId,
      name: this.name,
      width: this.width,
      height: this.height,
      durationSec: this.durationSec,
      hasAudio: this.hasAudio,
      volumePercent: this.volumePercent,
    };
  }

  static restore(s: SourceClipSnapshot): SourceClip {
    const raw = s as unknown as Record<string, unknown> | null;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new ValidationError("Bản nháp hỏng: dữ liệu video tải lên không hợp lệ");
    }
    if (
      typeof raw.uploadId !== "string" ||
      typeof raw.name !== "string" ||
      typeof raw.width !== "number" ||
      typeof raw.height !== "number" ||
      typeof raw.durationSec !== "number" ||
      typeof raw.hasAudio !== "boolean"
    ) {
      throw new ValidationError("Bản nháp hỏng: thông tin video tải lên không hợp lệ");
    }
    return SourceClip.create({
      uploadId: raw.uploadId,
      name: raw.name,
      width: raw.width,
      height: raw.height,
      durationSec: raw.durationSec,
      hasAudio: raw.hasAudio,
      ...(typeof raw.volumePercent === "number" ? { volumePercent: raw.volumePercent } : {}),
    });
  }
}
