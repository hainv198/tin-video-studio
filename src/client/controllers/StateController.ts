import { isSessionExpired, userMessage } from "@/client/errors/userMessage";

/** Controller có trạng thái bất biến và danh sách người nghe; View đọc `state` qua `subscribe`. */
export abstract class StateController<S> {
  private current: S;
  private readonly listeners = new Set<() => void>();

  protected constructor(
    initial: S,
    private readonly onAuthLost?: () => void,
  ) {
    this.current = initial;
  }

  get state(): S {
    return this.current;
  }

  /** Thuộc tính mũi tên để truyền thẳng cho useSyncExternalStore. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  protected set(next: S): void {
    this.current = next;
    for (const listener of [...this.listeners]) listener();
  }

  protected patch(partial: Partial<S>): void {
    this.set({ ...this.current, ...partial });
  }

  /** Đổi lỗi thành thông báo tiếng Việt; hết phiên thì báo lên trên để chuyển về trang đăng nhập. */
  protected report(error: unknown): string {
    if (isSessionExpired(error)) this.onAuthLost?.();
    return userMessage(error);
  }
}
