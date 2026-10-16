import { ForbiddenError, ValidationError } from "@/domain/errors";
import type { PasswordHasher } from "@/server/auth/PasswordHasher";
import { UserDirectory, type AppUser, type UserRole } from "@/server/auth/UserDirectory";
import type { EnvWriter } from "@/server/config/EnvFileWriter";
import { buildEntry } from "../../../scripts/lib/userEntry";

type Env = Record<string, string | undefined>;

/** Thông tin công khai của một tài khoản: không bao giờ có hash. */
export interface UserSummary {
  username: string;
  displayName: string;
  role: UserRole;
}

export interface UsersSnapshot {
  editable: boolean;
  readOnlyReason: string | null;
  maxUsers: number;
  users: UserSummary[];
}

export interface UsersChangeResult extends UsersSnapshot {
  /** Chỉ có khi không ghi được tại chỗ: chuỗi APP_USERS mới để admin tự chép. */
  appUsers: string | null;
  restartRequired: boolean;
}

export interface UserAdminControllerOptions {
  writer: EnvWriter;
  env: Env;
  hasher: Pick<PasswordHasher, "hash">;
  /** Gọi sau khi lưu để làm mới các đối tượng server đang giữ cache (container). */
  onApplied: () => void;
}

const USERNAME = /^[a-z0-9._-]{3,32}$/;
const MAX_DISPLAY = 40;
const MIN_PASSWORD = 8;
const MAX_PASSWORD_BYTES = 72;

const VERCEL_REASON =
  "Đang chạy trên Vercel: sao chép giá trị APP_USERS mới vào Vercel → Settings → Environment Variables → APP_USERS rồi Redeploy.";
const PRODUCTION_REASON =
  "Bản chạy production không ghi .env.local từ giao diện (đặt TVS_ALLOW_CONFIG_EDIT=1 nếu đây là máy của bạn): sao chép giá trị APP_USERS mới vào biến môi trường rồi khởi động lại.";
const WRITE_FAILED_REASON =
  "Không ghi được .env.local: sao chép giá trị APP_USERS mới vào .env.local (hoặc Vercel → Settings → Environment Variables) rồi khởi động lại.";
const LAST_ADMIN = "Phải còn ít nhất một quản trị viên (admin)";

const normalize = (username: string) => username.trim().toLowerCase();
const summary = (u: AppUser): UserSummary => ({ username: u.username, displayName: u.displayName, role: u.role });

export class UserAdminController {
  constructor(private readonly options: UserAdminControllerOptions) {}

  list(): UsersSnapshot {
    const reason = this.readOnlyReason();
    return {
      editable: reason === null,
      readOnlyReason: reason,
      maxUsers: UserDirectory.MAX_USERS,
      users: this.current().map(summary),
    };
  }

  /** Điều phối yêu cầu từ API: {action, ...}. actor là tên đăng nhập của admin đang thao tác. */
  async perform(actor: string, body: unknown): Promise<UsersChangeResult> {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new ValidationError("Yêu cầu tài khoản không hợp lệ");
    }
    const b = body as Record<string, unknown>;
    switch (b.action) {
      case "add":
        return this.add(b);
      case "setPassword":
        return this.setPassword(str(b.username), str(b.password));
      case "setRole":
        return this.setRole(actor, str(b.username), str(b.role));
      case "remove":
        return this.remove(actor, str(b.username));
      default:
        throw new ValidationError("Thao tác tài khoản không hợp lệ");
    }
  }

  async add(input: unknown): Promise<UsersChangeResult> {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new ValidationError("Thông tin tài khoản không hợp lệ");
    }
    const raw = input as Record<string, unknown>;
    const username = normalize(str(raw.username));
    const displayName = str(raw.displayName).trim();
    const password = str(raw.password);
    const role = raw.role === undefined || raw.role === "" ? "user" : str(raw.role);

    assertUsername(username);
    assertDisplayName(displayName);
    assertPassword(password);
    assertRole(role);

    const users = this.current();
    if (users.some((u) => u.username === username)) throw new ValidationError(`Tài khoản ${username} đã tồn tại`);
    if (users.length >= UserDirectory.MAX_USERS) {
      throw new ValidationError(`Chỉ được tối đa ${UserDirectory.MAX_USERS} tài khoản`);
    }

    const entry = await buildEntry([username, displayName, password, role], this.options.hasher);
    if (!entry) throw new ValidationError("Thông tin tài khoản không hợp lệ");
    return this.commit([...users, { ...entry, role }]);
  }

  async setPassword(username: string, password: string): Promise<UsersChangeResult> {
    assertPassword(password);
    const users = this.current();
    const target = findOrThrow(users, username);
    const passwordHash = await this.options.hasher.hash(password);
    return this.commit(users.map((u) => (u === target ? { ...u, passwordHash } : u)));
  }

  async setRole(actor: string, username: string, role: string): Promise<UsersChangeResult> {
    assertRole(role);
    const users = this.current();
    const target = findOrThrow(users, username);
    if (target.username === normalize(actor) && role !== "admin") {
      throw new ForbiddenError("Không thể tự hạ quyền quản trị của chính mình");
    }
    const next = users.map((u) => (u === target ? { ...u, role } : u));
    assertHasAdmin(next);
    return this.commit(next);
  }

  async remove(actor: string, username: string): Promise<UsersChangeResult> {
    const users = this.current();
    const target = findOrThrow(users, username);
    if (target.username === normalize(actor)) throw new ForbiddenError("Không thể tự xoá tài khoản của chính mình");
    const next = users.filter((u) => u !== target);
    if (next.length === 0) throw new ValidationError("Phải còn ít nhất một tài khoản");
    assertHasAdmin(next);
    return this.commit(next);
  }

  private current(): AppUser[] {
    try {
      return UserDirectory.fromEnv(this.options.env.APP_USERS).all();
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : "APP_USERS không đọc được");
    }
  }

  /** Kiểm lại bằng chính UserDirectory, rồi ghi tại chỗ hoặc trả chuỗi để admin tự chép. */
  private async commit(users: AppUser[]): Promise<UsersChangeResult> {
    const json = JSON.stringify(
      users.map((u) => ({ username: u.username, passwordHash: u.passwordHash, displayName: u.displayName, role: u.role })),
    );
    const encoded = Buffer.from(json, "utf8").toString("base64");
    UserDirectory.fromEnv(encoded);

    const blocked = this.readOnlyReason();
    if (blocked) return { ...this.list(), appUsers: encoded, restartRequired: false };

    try {
      await this.options.writer.apply({ set: { APP_USERS: encoded }, clear: [] });
    } catch {
      return { ...this.list(), editable: false, readOnlyReason: WRITE_FAILED_REASON, appUsers: encoded, restartRequired: false };
    }

    this.options.env.APP_USERS = encoded;
    let restartRequired = false;
    try {
      this.options.onApplied();
    } catch {
      restartRequired = true;
    }
    return { ...this.list(), appUsers: null, restartRequired };
  }

  private readOnlyReason(): string | null {
    const { env } = this.options;
    if (env.VERCEL) return VERCEL_REASON;
    if (env.NODE_ENV === "production" && env.TVS_ALLOW_CONFIG_EDIT !== "1") return PRODUCTION_REASON;
    return null;
  }
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function assertUsername(username: string): void {
  if (!USERNAME.test(username)) {
    throw new ValidationError("Tên đăng nhập cần 3–32 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang");
  }
}

function assertDisplayName(displayName: string): void {
  if (displayName.length < 1 || displayName.length > MAX_DISPLAY) {
    throw new ValidationError(`Tên hiển thị cần 1–${MAX_DISPLAY} ký tự`);
  }
}

function assertPassword(password: string): void {
  if (password.length < MIN_PASSWORD) throw new ValidationError(`Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự`);
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    throw new ValidationError(`Mật khẩu tối đa ${MAX_PASSWORD_BYTES} ký tự (chữ có dấu tính nhiều hơn một)`);
  }
}

function assertRole(role: string): asserts role is UserRole {
  if (role !== "admin" && role !== "user") throw new ValidationError("Role chỉ nhận admin hoặc user");
}

function assertHasAdmin(users: AppUser[]): void {
  if (!users.some((u) => u.role === "admin")) throw new ValidationError(LAST_ADMIN);
}

function findOrThrow(users: AppUser[], username: string): AppUser {
  const name = normalize(username);
  const found = users.find((u) => u.username === name);
  if (!found) throw new ValidationError(`Không tìm thấy tài khoản ${name || "(trống)"}`);
  return found;
}
