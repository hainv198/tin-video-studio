import { describe, expect, it, vi } from "vitest";
import { randomPassword } from "@/app/tai-khoan/randomPassword";
import { UsersPanelController, type UsersApi } from "@/app/tai-khoan/UsersPanelController";
import type { UsersChangeResult, UsersSnapshot } from "@/server/users/UserAdminController";

const snap = (names: string[]): UsersSnapshot => ({
  editable: true,
  readOnlyReason: null,
  maxUsers: 5,
  users: names.map((username) => ({ username, displayName: username, role: username === "hai" ? "admin" : "user" })),
});

const result = (names: string[], extra: Partial<UsersChangeResult> = {}): UsersChangeResult => ({
  ...snap(names),
  appUsers: null,
  restartRequired: false,
  ...extra,
});

function make() {
  const api: UsersApi = {
    add: vi.fn(async () => result(["hai", "lan", "minh"])),
    setPassword: vi.fn(async () => result(["hai", "lan"])),
    setRole: vi.fn(async () => result(["hai", "lan"])),
    remove: vi.fn(async () => result(["hai"])),
  };
  return { api, controller: new UsersPanelController(api, snap(["hai", "lan"])) };
}

describe("UsersPanelController", () => {
  it("thêm: gọi api, cập nhật danh sách, báo thành công", async () => {
    const { api, controller } = make();
    const ok = await controller.add({ username: " minh ", displayName: "Minh", password: "12345678", role: "user" });
    expect(ok).toBe(true);
    expect(api.add).toHaveBeenCalledWith({ username: "minh", displayName: "Minh", password: "12345678", role: "user" });
    expect(controller.state.snapshot.users).toHaveLength(3);
    expect(controller.state.message).toEqual({ tone: "ok", text: "Đã thêm tài khoản minh" });
    expect(controller.state.oneTimePassword).toBeNull();
  });

  it("mật khẩu ngẫu nhiên: hiện một lần, mất ở thao tác sau", async () => {
    const { controller } = make();
    await controller.add({ username: "minh", displayName: "Minh", password: "Ngau-Nhien-1", role: "user" }, true);
    expect(controller.state.oneTimePassword).toEqual({ username: "minh", password: "Ngau-Nhien-1" });
    await controller.remove("lan");
    expect(controller.state.oneTimePassword).toBeNull();
  });

  it("đổi mật khẩu ngẫu nhiên cũng hiện một lần", async () => {
    const { api, controller } = make();
    await controller.setPassword("lan", "Ngau-Nhien-2", true);
    expect(api.setPassword).toHaveBeenCalledWith("lan", "Ngau-Nhien-2");
    expect(controller.state.oneTimePassword).toEqual({ username: "lan", password: "Ngau-Nhien-2" });
    expect(controller.state.message?.text).toBe("Đã đổi mật khẩu của lan");
  });

  it("mật khẩu ngắn: không gọi api", async () => {
    const { api, controller } = make();
    expect(await controller.setPassword("lan", "ngan")).toBe(false);
    expect(api.setPassword).not.toHaveBeenCalled();
    expect(controller.state.message?.tone).toBe("error");
  });

  it("đổi role và xoá", async () => {
    const { api, controller } = make();
    await controller.setRole("lan", "admin");
    expect(api.setRole).toHaveBeenCalledWith("lan", "admin");
    expect(controller.state.message?.text).toBe("Đã đổi role của lan thành admin");
    await controller.remove("lan");
    expect(controller.state.snapshot.users.map((u) => u.username)).toEqual(["hai"]);
    expect(controller.state.message?.text).toBe("Đã xoá tài khoản lan");
  });

  it("chế độ sao chép: giữ chuỗi APP_USERS, báo cần dán", async () => {
    const { api, controller } = make();
    (api.remove as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      result(["hai", "lan"], { editable: false, readOnlyReason: "Đang chạy trên Vercel", appUsers: "QUJD" }),
    );
    await controller.remove("lan");
    expect(controller.state.appUsers).toBe("QUJD");
    expect(controller.state.message?.text).toContain("Sao chép giá trị");
    expect(controller.state.snapshot.editable).toBe(false);
  });

  it("cần khởi động lại thì nói rõ", async () => {
    const { api, controller } = make();
    (api.remove as ReturnType<typeof vi.fn>).mockResolvedValueOnce(result(["hai"], { restartRequired: true }));
    await controller.remove("lan");
    expect(controller.state.message?.text).toContain("khởi động lại");
  });

  it("lỗi api: thông báo lỗi, hết bận, báo người nghe", async () => {
    const { api, controller } = make();
    (api.remove as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Không thể tự xoá"));
    const listener = vi.fn();
    controller.subscribe(listener);
    expect(await controller.remove("hai")).toBe(false);
    expect(controller.state.message).toEqual({ tone: "error", text: "Không thể tự xoá" });
    expect(controller.state.busy).toBe(false);
    expect(listener).toHaveBeenCalled();
  });
});

describe("randomPassword", () => {
  it("đủ dài, chỉ ký tự dễ đọc, lấy từ nguồn ngẫu nhiên được truyền vào", () => {
    const fill = vi.fn((a: Uint8Array) => {
      for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) % 256;
      return a;
    });
    const p = randomPassword(16, fill);
    expect(p).toHaveLength(16);
    expect(p).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
    expect(fill).toHaveBeenCalled();
  });

  it("mặc định dùng crypto.getRandomValues, hai lần khác nhau, ≥ 8 ký tự", () => {
    const a = randomPassword();
    const b = randomPassword();
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(a).not.toBe(b);
  });
});
