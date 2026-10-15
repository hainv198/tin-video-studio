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
    if (this.db) return this.db;
    const promise = new Promise<IDBDatabase>((resolve, reject) => {
      const fail = (cause?: unknown) => {
        this.db = null; // lần sau thử mở lại
        reject(new Error("Không mở được bộ nhớ trình duyệt", { cause }));
      };
      try {
        const request = this.factory.open(this.dbName, DB_VERSION);
        request.onupgradeneeded = () => {
          request.result.createObjectStore(this.storeName);
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            this.db = null;
          };
          db.onclose = () => {
            this.db = null;
          };
          resolve(db);
        };
        request.onerror = () => fail(request.error);
        request.onblocked = () => fail();
      } catch (error) {
        fail(error);
      }
    });
    this.db = promise;
    // Lỗi đồng bộ trong executor đã reject trước khi gán cache: dọn lại ở đây.
    promise.catch(() => {
      if (this.db === promise) this.db = null;
    });
    return promise;
  }

  /** Đóng kết nối; lần gọi sau sẽ mở lại. */
  async close(): Promise<void> {
    const pending = this.db;
    this.db = null;
    if (!pending) return;
    try {
      (await pending).close();
    } catch {
      // mở không thành công thì không có gì để đóng
    }
  }

  private async run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      let tx: IDBTransaction;
      let request: IDBRequest<T>;
      try {
        tx = db.transaction(this.storeName, mode);
        request = work(tx.objectStore(this.storeName));
      } catch (error) {
        if ((error as { name?: string } | null)?.name === "InvalidStateError") this.db = null;
        reject(new Error("Lỗi ghi/đọc bộ nhớ trình duyệt", { cause: error }));
        return;
      }
      let result: T;
      request.onsuccess = () => {
        result = request.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => {
        const cause = tx.error ?? request.error;
        reject(
          new Error(
            cause?.name === "QuotaExceededError"
              ? "Bộ nhớ trình duyệt đã đầy, hãy xoá bớt file đã tải lên"
              : "Lỗi ghi/đọc bộ nhớ trình duyệt",
            { cause },
          ),
        );
      };
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
