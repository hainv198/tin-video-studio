import type { UserRole } from "@/server/auth/UserDirectory";
import type { UsersChangeResult, UsersSnapshot } from "@/server/users/UserAdminController";

export interface NewUserInput {
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
}

export interface UsersApi {
  add(input: NewUserInput): Promise<UsersChangeResult>;
  setPassword(username: string, password: string): Promise<UsersChangeResult>;
  setRole(username: string, role: UserRole): Promise<UsersChangeResult>;
  remove(username: string): Promise<UsersChangeResult>;
}

export interface PanelMessage {
  tone: "ok" | "error";
  text: string;
}

export interface UsersPanelState {
  snapshot: UsersSnapshot;
  busy: boolean;
  message: PanelMessage | null;
  /** Chuỗi APP_USERS mới khi không ghi được tại chỗ (Vercel). */
  appUsers: string | null;
  /** Mật khẩu ngẫu nhiên vừa tạo: chỉ giữ tới thao tác kế tiếp, không lưu ở đâu. */
  oneTimePassword: { username: string; password: string } | null;
}

const MIN_PASSWORD = 8;
const RESTART_TEXT = "Đã lưu nhưng cần khởi động lại ứng dụng để áp dụng";
const COPY_TEXT =
  "Chưa áp dụng: Sao chép giá trị APP_USERS bên dưới vào Vercel → Settings → Environment Variables → APP_USERS rồi Redeploy";

export class UsersPanelController {
  private current: UsersPanelState;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly api: UsersApi,
    initial: UsersSnapshot,
  ) {
    this.current = { snapshot: initial, busy: false, message: null, appUsers: null, oneTimePassword: null };
  }

  get state(): UsersPanelState {
    return this.current;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  add(input: NewUserInput, generated = false): Promise<boolean> {
    const clean = { ...input, username: input.username.trim().toLowerCase(), displayName: input.displayName.trim() };
    if (!this.checkPassword(clean.password)) return Promise.resolve(false);
    return this.run(
      () => this.api.add(clean),
      `Đã thêm tài khoản ${clean.username}`,
      generated ? { username: clean.username, password: clean.password } : null,
    );
  }

  setPassword(username: string, password: string, generated = false): Promise<boolean> {
    if (!this.checkPassword(password)) return Promise.resolve(false);
    return this.run(
      () => this.api.setPassword(username, password),
      `Đã đổi mật khẩu của ${username}`,
      generated ? { username, password } : null,
    );
  }

  setRole(username: string, role: UserRole): Promise<boolean> {
    return this.run(() => this.api.setRole(username, role), `Đã đổi role của ${username} thành ${role}`, null);
  }

  remove(username: string): Promise<boolean> {
    return this.run(() => this.api.remove(username), `Đã xoá tài khoản ${username}`, null);
  }

  private checkPassword(password: string): boolean {
    if (password.length >= MIN_PASSWORD) return true;
    this.set({ message: { tone: "error", text: `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự` }, oneTimePassword: null });
    return false;
  }

  private async run(
    call: () => Promise<UsersChangeResult>,
    doneText: string,
    reveal: UsersPanelState["oneTimePassword"],
  ): Promise<boolean> {
    this.set({ busy: true, message: null, oneTimePassword: null });
    try {
      const result = await call();
      const snapshot: UsersSnapshot = {
        editable: result.editable,
        readOnlyReason: result.readOnlyReason,
        maxUsers: result.maxUsers,
        users: result.users,
      };
      const text = result.appUsers ? COPY_TEXT : result.restartRequired ? RESTART_TEXT : doneText;
      this.set({ snapshot, busy: false, message: { tone: "ok", text }, appUsers: result.appUsers, oneTimePassword: reveal });
      return true;
    } catch (error) {
      const text = error instanceof Error ? error.message : "Không lưu được, thử lại sau";
      this.set({ busy: false, message: { tone: "error", text } });
      return false;
    }
  }

  private set(patch: Partial<UsersPanelState>): void {
    this.current = { ...this.current, ...patch };
    for (const listener of this.listeners) listener();
  }
}
