import { describe, expect, it } from "vitest";
import { readApiError } from "@/client/services/apiError";
import { ApiError } from "@/client/services/AuthClient";

describe("readApiError", () => {
  it("đọc code và message của server", async () => {
    const res = Response.json({ error: { code: "QUOTA", message: "Hết hạn mức" } }, { status: 429 });
    const err = await readApiError(res);
    expect(err).toBeInstanceOf(ApiError);
    expect([err.status, err.code, err.message]).toEqual([429, "QUOTA", "Hết hạn mức"]);
  });

  it("thân không phải JSON thì dùng mặc định", async () => {
    const err = await readApiError(new Response("<html>lỗi</html>", { status: 502 }));
    expect([err.status, err.code, err.message]).toEqual([502, "INTERNAL", "Lỗi máy chủ"]);
  });
});
