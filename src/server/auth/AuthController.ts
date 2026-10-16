import { z } from "zod";
import { AuthError, ValidationError } from "@/domain/errors";
import type { PasswordHasher } from "./PasswordHasher";
import type { SessionService, SessionUser } from "./SessionService";
import type { UserDirectory, UserRole } from "./UserDirectory";

const LoginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

export interface AuthenticatedUser extends SessionUser {
  role: UserRole;
}

export class AuthController {
  constructor(
    private readonly users: UserDirectory,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
  ) {}

  async login(input: unknown): Promise<{ token: string; user: SessionUser }> {
    const parsed = LoginSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Thiếu tên đăng nhập hoặc mật khẩu");
    const account = this.users.find(parsed.data.username);
    if (!account || !(await this.hasher.verify(parsed.data.password, account.passwordHash))) {
      throw new AuthError();
    }
    const user: SessionUser = { username: account.username, displayName: account.displayName };
    return { token: await this.sessions.issue(user), user };
  }

  /** Role tra từ danh bạ mỗi lần (không nằm trong token) nên đổi APP_USERS có hiệu lực ngay. */
  async authenticate(token: string | undefined): Promise<AuthenticatedUser> {
    const session = await this.sessions.verify(token);
    const account = session ? this.users.find(session.username) : undefined;
    if (!session || !account) throw new AuthError("Phiên đăng nhập đã hết hạn");
    return { ...session, role: account.role };
  }
}
