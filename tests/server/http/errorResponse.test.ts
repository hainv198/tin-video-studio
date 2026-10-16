import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/domain/errors";
import { toErrorResponse } from "@/server/http/errorResponse";

describe("toErrorResponse", () => {
  it("FORBIDDEN -> 403", async () => {
    const res = toErrorResponse(new ForbiddenError("Chỉ quản trị viên được thay đổi cấu hình"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: { code: "FORBIDDEN", message: "Chỉ quản trị viên được thay đổi cấu hình" },
    });
  });
});
