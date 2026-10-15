/** Hằng mã hoá của bộ dựng, gom một chỗ để đổi được từ cấu hình thay vì sửa worker. */
export const RENDER_VIDEO_BITRATE = 8_000_000;
export const RENDER_AUDIO_BITRATE = 192_000;
/** Lựa chọn cho người dùng ở bước dựng (chặng sau); "light" cho mạng yếu/file nhỏ. */
export const VIDEO_BITRATE_CHOICES = { standard: 8_000_000, light: 5_000_000 } as const;

export type VideoQuality = keyof typeof VIDEO_BITRATE_CHOICES;

export const VIDEO_QUALITY_LABELS: Record<VideoQuality, string> = {
  standard: "Chuẩn (8 Mbps, nét nhất)",
  light: "Nhẹ (5 Mbps, nhỏ hơn ≈ 1/3, nhìn không khác)",
};

export const DEFAULT_VIDEO_QUALITY: VideoQuality = "standard";
