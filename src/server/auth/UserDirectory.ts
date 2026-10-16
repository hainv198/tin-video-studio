import { z } from "zod";

export type UserRole = "admin" | "user";

export interface AppUser {
  username: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
}

const UserSchema = z.object({
  username: z.string().regex(/^[a-z0-9._-]{3,32}$/),
  passwordHash: z.string().startsWith("$2"),
  displayName: z.string().trim().min(1).max(60),
  role: z.enum(["admin", "user"]).default("user"),
});

const normalize = (username: string) => username.trim().toLowerCase();

export class UserDirectory {
  static readonly MAX_USERS = 5;

  private readonly byName: ReadonlyMap<string, AppUser>;

  private constructor(users: readonly AppUser[]) {
    this.byName = new Map(users.map((u) => [u.username, u]));
  }

  static fromEnv(raw: string | undefined): UserDirectory {
    const value = raw?.trim();
    if (!value) throw new Error("APP_USERS chưa được cấu hình");

    let parsed: unknown;
    try {
      const json = value.startsWith("[") ? value : Buffer.from(value, "base64").toString("utf8");
      parsed = JSON.parse(json);
    } catch {
      throw new Error("APP_USERS không đọc được (cần base64 của JSON hoặc JSON bắt đầu bằng [)");
    }

    const result = z.array(UserSchema).min(1).safeParse(parsed);
    if (!result.success) throw new Error("APP_USERS sai định dạng (cần username, passwordHash, displayName; role tuỳ chọn là admin hoặc user)");
    if (result.data.length > UserDirectory.MAX_USERS) {
      throw new Error(`APP_USERS tối đa ${UserDirectory.MAX_USERS} tài khoản`);
    }

    const seen = new Set<string>();
    for (const u of result.data) {
      if (seen.has(u.username)) throw new Error(`APP_USERS bị trùng tài khoản ${u.username}`);
      seen.add(u.username);
    }
    return new UserDirectory(result.data);
  }

  find(username: string): AppUser | undefined {
    return this.byName.get(normalize(username));
  }

  get size(): number {
    return this.byName.size;
  }
}
