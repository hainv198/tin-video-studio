import type { KeyValueStore } from "./KeyValueStore";

const DB_VERSION = 1;

export class IdbKeyValueStore implements KeyValueStore {
  private db: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly factory: IDBFactory,
    private readonly dbName = "tin-video-studio",
    private readonly storeName = "kv",
  ) {}

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory.open(this.dbName, DB_VERSION);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(this.storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.db = null; // lần sau thử mở lại
        reject(new Error("Không mở được bộ nhớ trình duyệt"));
      };
    });
    return this.db;
  }

  private async run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      let result: T;
      const request = work(tx.objectStore(this.storeName));
      request.onsuccess = () => {
        result = request.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () =>
        reject(
          new Error(
            tx.error?.name === "QuotaExceededError"
              ? "Bộ nhớ trình duyệt đã đầy, hãy xoá bớt file đã tải lên"
              : "Lỗi ghi/đọc bộ nhớ trình duyệt",
          ),
        );
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    return (await this.run("readonly", (s) => s.get(key))) as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.run("readwrite", (s) => s.put(value, key));
  }

  async delete(key: string): Promise<void> {
    await this.run("readwrite", (s) => s.delete(key));
  }

  async keys(prefix = ""): Promise<string[]> {
    const all = await this.run("readonly", (s) => s.getAllKeys());
    return all.filter((k): k is string => typeof k === "string" && k.startsWith(prefix)).sort();
  }
}
