/** Các họ font người dùng chọn được cho chữ trong video. Id ổn định (lưu trong bản nháp). */
export const FONT_CHOICES = [
  { id: "phudu", label: "Phudu" },
  { id: "be-vietnam-pro", label: "Be Vietnam Pro" },
  { id: "oswald", label: "Oswald" },
  { id: "montserrat", label: "Montserrat" },
  { id: "roboto-condensed", label: "Roboto Condensed" },
  { id: "barlow-condensed", label: "Barlow Condensed" },
] as const;

export type FontId = (typeof FONT_CHOICES)[number]["id"];

/** Phụ đề là tính năng mới: mặc định Phudu. */
export const DEFAULT_SUBTITLE_FONT_ID: FontId = "phudu";
/** Chữ tiêu đề và nhãn: giữ Barlow Condensed để video cũ không đổi hình ảnh. */
export const DEFAULT_TEXT_FONT_ID: FontId = "barlow-condensed";

export function isFontId(v: unknown): v is FontId {
  return FONT_CHOICES.some((f) => f.id === v);
}
