import type { ConfigSnapshot, ConfigUpdateResult } from "@/server/config/ConfigController";

export interface ConfigApi {
  save(key: string, value: string): Promise<ConfigUpdateResult>;
  clear(key: string): Promise<ConfigUpdateResult>;
}

export interface PanelMessage {
  tone: "ok" | "error";
  text: string;
}

export interface PanelState {
  snapshot: ConfigSnapshot;
  busyKey: string | null;
  message: PanelMessage | null;
}

const RESTART_TEXT = "Đã lưu nhưng cần khởi động lại ứng dụng để áp dụng";

export class ConfigPanelController {
  private current: PanelState;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly api: ConfigApi,
    initial: ConfigSnapshot,
  ) {
    this.current = { snapshot: initial, busyKey: null, message: null };
  }

  get state(): PanelState {
    return this.current;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async save(key: string, value: string): Promise<boolean> {
    const trimmed = value.trim();
    if (!trimmed) {
      this.set({ message: { tone: "error", text: "Hãy dán giá trị mới vào ô trước khi lưu" } });
      return false;
    }
    return this.run(key, () => this.api.save(key, trimmed), "Đã lưu");
  }

  async clear(key: string): Promise<boolean> {
    return this.run(key, () => this.api.clear(key), "Đã xoá");
  }

  private async run(key: string, call: () => Promise<ConfigUpdateResult>, doneText: string): Promise<boolean> {
    this.set({ busyKey: key, message: null });
    try {
      const result = await call();
      const snapshot: ConfigSnapshot = { editable: result.editable, readOnlyReason: result.readOnlyReason, keys: result.keys };
      this.set({
        snapshot,
        busyKey: null,
        message: result.restartRequired ? { tone: "ok", text: RESTART_TEXT } : { tone: "ok", text: doneText },
      });
      return true;
    } catch (error) {
      const text = error instanceof Error ? error.message : "Không lưu được, thử lại sau";
      this.set({ busyKey: null, message: { tone: "error", text } });
      return false;
    }
  }

  private set(patch: Partial<PanelState>): void {
    this.current = { ...this.current, ...patch };
    for (const listener of this.listeners) listener();
  }
}
