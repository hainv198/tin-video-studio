import { DomainError } from "@/domain/errors";
import { RenderCancelledError } from "@/client/render/errors";
import { ApiError } from "@/client/services/apiError";

const VIETNAMESE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/**
 * Thông báo cho người dùng. Lỗi do chính app ném ra đã là tiếng Việt thì giữ nguyên;
 * lỗi thô của trình duyệt (DOMException, TypeError "Failed to fetch"…) đổi thành thông báo chung.
 */
export function userMessage(error: unknown, fallback = "Có lỗi xảy ra, thử lại sau"): string {
  if (error instanceof DomainError || error instanceof ApiError || error instanceof RenderCancelledError) return error.message;
  if (error instanceof Error && !(error instanceof DOMException) && VIETNAMESE.test(error.message)) return error.message;
  return fallback;
}

/** Máy chủ báo hết hạn mức giọng đọc (429, mã QUOTA). */
export function isQuotaExhausted(error: unknown): boolean {
  return error instanceof ApiError && error.code === "QUOTA";
}

export function isSessionExpired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
