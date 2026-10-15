import { ApiError, type AuthApi } from "@/client/services/AuthClient";

export type LoginState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "done"; displayName: string };

/** Chỉ nhận đường dẫn nội bộ ("/x"); chặn "//host", "/\host" và URL tuyệt đối để tránh open redirect. */
export function safeNextPath(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) return next;
  return "/studio";
}

export class SessionController {
  private current: LoginState = { status: "idle" };
  private readonly listeners = new Set<() => void>();

  constructor(private readonly api: AuthApi) {}

  get state(): LoginState {
    return this.current;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async login(username: string, password: string): Promise<boolean> {
    if (!username.trim() || !password) {
      this.set({ status: "error", message: "Nhập tên đăng nhập và mật khẩu" });
      return false;
    }
    this.set({ status: "submitting" });
    try {
      const user = await this.api.login(username.trim(), password);
      this.set({ status: "done", displayName: user.displayName });
      return true;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Không kết nối được máy chủ, thử lại sau";
      this.set({ status: "error", message });
      return false;
    }
  }

  async logout(): Promise<void> {
    await this.api.logout();
    this.set({ status: "idle" });
  }

  private set(state: LoginState): void {
    this.current = state;
    for (const listener of this.listeners) listener();
  }
}
