import { ValidationError } from "./errors";

/** Ảnh banner chân người dùng tải lên: ≤ 5 MB, rộng ≥ 720 px, ngang tỉ lệ 2–5 (dải vẽ 1080×360 = 3:1, vẽ kiểu cover). */
export const FOOTER_BANNER_LIMITS = { maxBytes: 5 * 1024 * 1024, minWidth: 720, minRatio: 2, maxRatio: 5 } as const;

const ratioText = (n: number) => n.toFixed(2).replace(".", ",");

export function checkFooterBanner(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new ValidationError("Không đọc được kích thước ảnh banner");
  }
  const L = FOOTER_BANNER_LIMITS;
  const ratio = width / height;
  if (ratio < L.minRatio || ratio > L.maxRatio) {
    throw new ValidationError(
      `Banner phải là ảnh ngang, tỉ lệ rộng/cao từ ${L.minRatio} đến ${L.maxRatio} (ảnh này ${ratioText(ratio)}). Khuyên dùng 3:1, ví dụ 2048×682.`,
    );
  }
  if (width < L.minWidth) throw new ValidationError(`Banner quá nhỏ: cần rộng ít nhất ${L.minWidth} px (ảnh này ${Math.round(width)} px)`);
}
