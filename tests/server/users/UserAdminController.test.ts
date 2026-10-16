import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, ValidationError } from "@/domain/errors";
import { BcryptPasswordHasher } from "@/server/auth/PasswordHasher";
import { UserDirectory } from "@/server/auth/UserDirectory";
import { EnvFileWriter } from "@/server/config/EnvFileWriter";
import { UserAdminController } from "@/server/users/UserAdminController";

const hasher = new BcryptPasswordHasher(4);
const OLD_HASH = "$2b$04$abcdefghijklmnopqrstuuJ0123456789abcdefghijklmnopqrstu";
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v), "utf8").toString("base64");
const decode = (raw: string) => JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Record<string, unknown>[];

function seed(extra: Record<string, unknown>[] = []) {
  return b64([
    { username: "hai", passwordHash: OLD_HASH, displayName: "Hải", role: "admin" },
    { username: "lan", passwordHash: OLD_HASH, displayName: "Lan" },
    ...extra,
  ]);
}

function make(env: Record<string, string | undefined> = { APP_USERS: seed() }, apply = vi.fn(async () => {})) {
  const onApplied = vi.fn();
  const controller = new UserAdminController({ writer: { apply }, env, hasher, onApplied });
  return { controller, apply, onApplied, env };
}

/** Lấy APP_USERS đã ghi qua writer giả. */
function written(apply: ReturnType<typeof vi.fn>): string {
  const call = apply.mock.calls.at(-1) as [{ set: Record<string, string> }] | undefined;
  const value = call?.[0].set.APP_USERS;
  if (!value) throw new Error("chưa ghi APP_USERS");
  return value;
}

describe("UserAdminController.list", () => {
  it("chỉ trả tên, tên hiển thị, role; không có hash", () => {
    const { controller } = make();
    const snap = controller.list();
    expect(snap.users).toEqual([
      { username: "hai", displayName: "Hải", role: "admin" },
      { username: "lan", displayName: "Lan", role: "user" },
    ]);
    expect(snap.editable).toBe(true);
    expect(snap.maxUsers).toBe(5);
    expect(JSON.stringify(snap)).not.toContain("$2");
  });

  it("chế độ Vercel: chỉ sao chép, vẫn đọc danh sách từ env hiện tại", () => {
    const snap = make({ APP_USERS: seed(), VERCEL: "1" }).controller.list();
    expect(snap.editable).toBe(false);
    expect(snap.readOnlyReason).toContain("Vercel");
    expect(snap.users.length).toBe(2);
  });

  it("APP_USERS hỏng: ValidationError", () => {
    expect(() => make({ APP_USERS: "hong" }).controller.list()).toThrow(ValidationError);
  });
});

describe("UserAdminController.add", () => {
  it("thêm tài khoản, mã hoá mật khẩu, ghi env, làm mới container, không trả hash", async () => {
    const { controller, apply, onApplied, env } = make();
    const res = await controller.add({ username: "  Minh.T ", displayName: " Minh ", password: "matkhau-moi-1", role: "user" });
    const raw = written(apply);
    const users = decode(raw);
    expect(users.map((u) => u.username)).toEqual(["hai", "lan", "minh.t"]);
    const minh = users[2]!;
    expect(minh.displayName).toBe("Minh");
    expect(await hasher.verify("matkhau-moi-1", String(minh.passwordHash))).toBe(true);
    expect(users[0]!.passwordHash).toBe(OLD_HASH);
    expect(env.APP_USERS).toBe(raw);
    expect(UserDirectory.fromEnv(env.APP_USERS).size).toBe(3);
    expect(onApplied).toHaveBeenCalledOnce();
    expect(res.appUsers).toBeNull();
    expect(res.users.map((u) => u.username)).toContain("minh.t");
    const text = JSON.stringify(res);
    expect(text).not.toContain("$2");
    expect(text).not.toContain("matkhau-moi-1");
  });

  it("thiếu role thì là user", async () => {
    const { controller } = make();
    const res = await controller.add({ username: "minh", displayName: "Minh", password: "12345678" });
    expect(res.users.find((u) => u.username === "minh")?.role).toBe("user");
  });

  it.each([
    [{ username: "ab", displayName: "A", password: "12345678" }, "Tên đăng nhập"],
    [{ username: "a".repeat(33), displayName: "A", password: "12345678" }, "Tên đăng nhập"],
    [{ username: "minh hai", displayName: "A", password: "12345678" }, "Tên đăng nhập"],
    [{ username: "minh", displayName: "  ", password: "12345678" }, "Tên hiển thị"],
    [{ username: "minh", displayName: "x".repeat(41), password: "12345678" }, "Tên hiển thị"],
    [{ username: "minh", displayName: "A", password: "1234567" }, "Mật khẩu"],
    [{ username: "minh", displayName: "A", password: "x".repeat(73) }, "Mật khẩu"],
    [{ username: "minh", displayName: "A", password: "12345678", role: "boss" }, "Role"],
    [{ username: "HAI", displayName: "A", password: "12345678" }, "đã tồn tại"],
    [null, "không hợp lệ"],
  ])("từ chối %j", async (input, message) => {
    const { controller, apply } = make();
    await expect(controller.add(input)).rejects.toThrow(ValidationError);
    await expect(controller.add(input)).rejects.toThrow(message);
    expect(apply).not.toHaveBeenCalled();
  });

  it("tối đa 5 tài khoản", async () => {
    const more = ["c1c", "d2d", "e3e"].map((u) => ({ username: u, passwordHash: OLD_HASH, displayName: u }));
    const { controller, apply } = make({ APP_USERS: seed(more) });
    await expect(controller.add({ username: "f4f", displayName: "F", password: "12345678" })).rejects.toThrow("tối đa 5");
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("UserAdminController.setPassword / setRole / remove", () => {
  it("đổi mật khẩu: hash mới, giữ người khác", async () => {
    const { controller, apply } = make();
    await controller.setPassword("LAN", "mat-khau-moi-9");
    const users = decode(written(apply));
    expect(await hasher.verify("mat-khau-moi-9", String(users[1]!.passwordHash))).toBe(true);
    expect(users[0]!.passwordHash).toBe(OLD_HASH);
  });

  it("đổi mật khẩu: kiểm độ dài và tài khoản tồn tại", async () => {
    const { controller } = make();
    await expect(controller.setPassword("lan", "ngan")).rejects.toThrow("Mật khẩu");
    await expect(controller.setPassword("khongco", "12345678")).rejects.toThrow("Không tìm thấy tài khoản");
  });

  it("đổi role người khác", async () => {
    const { controller } = make();
    const res = await controller.setRole("hai", "lan", "admin");
    expect(res.users.find((u) => u.username === "lan")?.role).toBe("admin");
  });

  it("admin không tự hạ role của mình", async () => {
    const { controller, apply } = make();
    await expect(controller.setRole("hai", "hai", "user")).rejects.toThrow(ForbiddenError);
    expect(apply).not.toHaveBeenCalled();
  });

  it("luôn còn ít nhất một admin", async () => {
    const { controller, apply } = make({ APP_USERS: seed([{ username: "minh", passwordHash: OLD_HASH, displayName: "M", role: "admin" }]) });
    // minh hạ hai: còn minh là admin → được
    await controller.setRole("minh", "hai", "user");
    // hai giờ là user; nếu ai đó (vd. tài khoản đã bị đổi) cố hạ admin cuối cùng → chặn
    const after = make({ APP_USERS: written(apply) });
    await expect(after.controller.setRole("lan", "minh", "user")).rejects.toThrow("ít nhất một quản trị viên");
    await expect(after.controller.remove("lan", "minh")).rejects.toThrow("ít nhất một quản trị viên");
  });

  it("xoá tài khoản khác", async () => {
    const { controller, apply } = make();
    const res = await controller.remove("hai", "lan");
    expect(res.users.map((u) => u.username)).toEqual(["hai"]);
    expect(decode(written(apply)).length).toBe(1);
  });

  it("admin không tự xoá mình", async () => {
    const { controller, apply } = make();
    await expect(controller.remove("hai", "HAI")).rejects.toThrow(ForbiddenError);
    expect(apply).not.toHaveBeenCalled();
  });

  it("xoá tài khoản không có: lỗi", async () => {
    await expect(make().controller.remove("hai", "khongco")).rejects.toThrow("Không tìm thấy tài khoản");
  });
});

describe("UserAdminController.perform", () => {
  it("điều phối theo action", async () => {
    const { controller } = make();
    const res = await controller.perform("hai", { action: "setRole", username: "lan", role: "admin" });
    expect(res.users.find((u) => u.username === "lan")?.role).toBe("admin");
    await expect(controller.perform("hai", { action: "hack" })).rejects.toThrow(ValidationError);
    await expect(controller.perform("hai", "x")).rejects.toThrow(ValidationError);
  });
});

describe("chế độ chỉ sao chép", () => {
  it("Vercel: không ghi, không đổi env, trả chuỗi APP_USERS mới", async () => {
    const env = { APP_USERS: seed(), VERCEL: "1" };
    const { controller, apply, onApplied } = make(env);
    const res = await controller.add({ username: "minh", displayName: "Minh", password: "12345678" });
    expect(apply).not.toHaveBeenCalled();
    expect(onApplied).not.toHaveBeenCalled();
    expect(env.APP_USERS).toBe(seed());
    expect(res.appUsers).not.toBeNull();
    expect(decode(res.appUsers!).map((u) => u.username)).toEqual(["hai", "lan", "minh"]);
    expect(UserDirectory.fromEnv(res.appUsers!).size).toBe(3);
    expect(res.readOnlyReason).toContain("Vercel");
    expect(res.users.map((u) => u.username)).toEqual(["hai", "lan"]);
  });

  it("production không bật cờ: chỉ sao chép", async () => {
    const { controller, apply } = make({ APP_USERS: seed(), NODE_ENV: "production" });
    const res = await controller.remove("hai", "lan");
    expect(apply).not.toHaveBeenCalled();
    expect(res.appUsers).not.toBeNull();
  });

  it("ghi file lỗi: không đổi env, trả chuỗi để chép tay", async () => {
    const env = { APP_USERS: seed() };
    const { controller, onApplied } = make(
      env,
      vi.fn(async () => {
        throw new Error("EACCES");
      }),
    );
    const res = await controller.remove("hai", "lan");
    expect(env.APP_USERS).toBe(seed());
    expect(onApplied).not.toHaveBeenCalled();
    expect(res.appUsers).not.toBeNull();
    expect(res.readOnlyReason).toContain(".env.local");
  });
});

describe("ghi vào file .env.local thật (file tạm)", () => {
  let dir: string;
  let file: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "users-"));
    file = path.join(dir, ".env.local");
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("thay đúng dòng APP_USERS, giữ dòng khác và CRLF", async () => {
    await writeFile(file, `# ghi chu\r\nAUTH_SECRET=abc\r\nAPP_USERS=${seed()}\r\nGEMINI_API_KEY=k\r\n`, "utf8");
    const env: Record<string, string | undefined> = { APP_USERS: seed() };
    const controller = new UserAdminController({ writer: new EnvFileWriter(file), env, hasher, onApplied: () => {} });
    await controller.add({ username: "minh", displayName: "Minh", password: "12345678", role: "admin" });
    const text = await readFile(file, "utf8");
    expect(text).toBe(`# ghi chu\r\nAUTH_SECRET=abc\r\nAPP_USERS=${env.APP_USERS}\r\nGEMINI_API_KEY=k\r\n`);
    expect(UserDirectory.fromEnv(env.APP_USERS).find("minh")?.role).toBe("admin");
  });
});
