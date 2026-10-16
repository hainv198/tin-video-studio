export type TimerHandle = unknown;
export interface ConfirmScheduler {
  set(fn: () => void, ms: number): TimerHandle;
  clear(handle: TimerHandle): void;
}

const REAL_SCHEDULER: ConfirmScheduler = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export const CONFIRM_TIMEOUT_MS = 8000;

/** Xác nhận hai bước ngay trên giao diện: idle -> armed (tự về idle sau timeout) -> confirm. */
export class ConfirmGate {
  private armedFlag = false;
  private timer: TimerHandle | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly timeoutMs: number = CONFIRM_TIMEOUT_MS,
    private readonly scheduler: ConfirmScheduler = REAL_SCHEDULER,
  ) {}

  get armed(): boolean {
    return this.armedFlag;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): boolean => this.armedFlag;

  arm(): void {
    if (this.armedFlag) return;
    this.armedFlag = true;
    this.timer = this.scheduler.set(() => this.cancel(), this.timeoutMs);
    this.emit();
  }

  cancel(): void {
    this.clearTimer();
    if (!this.armedFlag) return;
    this.armedFlag = false;
    this.emit();
  }

  /** Trả true nếu đang armed (khi đó caller chạy hành động) và đưa về idle. */
  confirm(): boolean {
    if (!this.armedFlag) return false;
    this.cancel();
    return true;
  }

  dispose(): void {
    this.clearTimer();
    this.listeners.clear();
  }

  private clearTimer(): void {
    if (this.timer !== null) this.scheduler.clear(this.timer);
    this.timer = null;
  }

  private emit(): void {
    for (const l of [...this.listeners]) l();
  }
}
