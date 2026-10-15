/** Hằng mã hoá của bộ dựng, gom một chỗ để đổi được từ cấu hình thay vì sửa worker. */
export const RENDER_VIDEO_BITRATE = 8_000_000;
export const RENDER_AUDIO_BITRATE = 192_000;
/** Lựa chọn cho người dùng ở bước dựng (chặng sau); "light" cho mạng yếu/file nhỏ. */
export const VIDEO_BITRATE_CHOICES = { standard: 8_000_000, light: 5_000_000 } as const;
