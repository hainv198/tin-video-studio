import { describe, expect, it } from "vitest";
import { AuthError, DomainError, QuotaError, ValidationError } from "@/domain/errors";

describe("DomainError", () => {
  it("giữ mã lỗi và tên lớp", () => {
    const e = new ValidationError("Sai dữ liệu");
    expect(e).toBeInstanceOf(DomainError);
    expect(e.code).toBe("VALIDATION");
    expect(e.name).toBe("ValidationError");
    expect(e.message).toBe("Sai dữ liệu");
  });

  it("AuthError có thông báo mặc định tiếng Việt", () => {
    expect(new AuthError().message).toBe("Sai tên đăng nhập hoặc mật khẩu");
  });

  it("QuotaError mang mã QUOTA", () => {
    expect(new QuotaError("Hết hạn mức").code).toBe("QUOTA");
  });
});
