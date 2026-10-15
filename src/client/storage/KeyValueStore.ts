export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  /** Danh sách khoá (tuỳ chọn lọc theo tiền tố), sắp xếp tăng dần. */
  keys(prefix?: string): Promise<string[]>;
}

/** Cài đặt trong bộ nhớ cho test; sao chép bằng structuredClone khi ghi/đọc để giống ngữ nghĩa IndexedDB. */
export class MemoryKeyValueStore implements KeyValueStore {
  private readonly map = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.has(key) ? (structuredClone(this.map.get(key)) as T) : undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.map.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async keys(prefix = ""): Promise<string[]> {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}
