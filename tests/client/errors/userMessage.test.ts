import { describe, expect, it } from "vitest";
import { userMessage, isSessionExpired } from "@/client/errors/userMessage";
import { ValidationError } from "@/domain/errors";
import { ApiError } from "@/client/services/apiError";
import { RenderCancelledError } from "@/client/render/errors";

describe("userMessage", () => {
  it("giữ thông báo của lỗi miền, lỗi API và huỷ dựng", () => {
    expect(userMessage(new ValidationError("Nguồn tin tối đa 80 ký tự"))).toBe("Nguồn tin tối đa 80 ký tự");
    expect(userMessage(new ApiError(429, "QUOTA", "Hết hạn mức giọng đọc"))).toBe("Hết hạn mức giọng đọc");
    expect(userMessage(new RenderCancelledError())).toBe("Đã huỷ dựng video");
  });

  it("giữ Error thường nếu thông báo đã là tiếng Việt", () => {
    expect(userMessage(new Error("Lỗi bộ dựng: không rõ"))).toBe("Lỗi bộ dựng: không rõ");
  });

  it("lỗi tiếng Anh thô hoặc giá trị lạ thì dùng thông báo chung", () => {
    expect(userMessage(new DOMException("The source image cannot be decoded", "InvalidStateError"))).toBe(
      "Có lỗi xảy ra, thử lại sau",
    );
    expect(userMessage(new TypeError("Failed to fetch"), "Không tải được")).toBe("Không tải được");
    expect(userMessage("chuỗi")).toBe("Có lỗi xảy ra, thử lại sau");
  });

  it("nhận ra hết phiên", () => {
    expect(isSessionExpired(new ApiError(401, "AUTH", "x"))).toBe(true);
    expect(isSessionExpired(new ApiError(500, "INTERNAL", "x"))).toBe(false);
    expect(isSessionExpired(new Error("x"))).toBe(false);
  });
});
