import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { IdbKeyValueStore } from "@/client/storage/IdbKeyValueStore";
import { MemoryKeyValueStore, type KeyValueStore } from "@/client/storage/KeyValueStore";

const factories: Array<[string, () => KeyValueStore]> = [
  ["memory", () => new MemoryKeyValueStore()],
  ["idb", () => new IdbKeyValueStore(new IDBFactory() as unknown as IDBFactory)],
];

describe.each(factories)("KeyValueStore (%s)", (_name, create) => {
  it("ghi rồi đọc lại đối tượng có Uint8Array và Date", async () => {
    const store = create();
    await store.set("o", { a: new Uint8Array([1, 2, 3]), d: new Date(0), n: [1, { x: "y" }] });
    const got = await store.get<{ a: Uint8Array; d: Date; n: unknown[] }>("o");
    expect(got?.a).toBeInstanceOf(Uint8Array);
    expect(Array.from(got?.a ?? [])).toEqual([1, 2, 3]);
    expect(got?.d.getTime()).toBe(0);
    expect(got?.n).toEqual([1, { x: "y" }]);
  });

  it("khoá không có trả undefined; ghi đè được; xoá được", async () => {
    const store = create();
    expect(await store.get("none")).toBeUndefined();
    await store.set("k", 1);
    await store.set("k", 2);
    expect(await store.get("k")).toBe(2);
    await store.delete("k");
    expect(await store.get("k")).toBeUndefined();
    await store.delete("k"); // xoá khoá không có không lỗi
  });

  it("keys lọc theo tiền tố và sắp xếp tăng dần", async () => {
    const store = create();
    for (const k of ["blob:b", "brand:x", "blob:a", "draft"]) await store.set(k, 1);
    expect(await store.keys()).toEqual(["blob:a", "blob:b", "brand:x", "draft"]);
    expect(await store.keys("blob:")).toEqual(["blob:a", "blob:b"]);
    expect(await store.keys("zzz")).toEqual([]);
  });

  it("lưu và đọc Blob", async () => {
    const store = create();
    await store.set("b", new Blob(["xin chào"], { type: "text/plain" }));
    const blob = await store.get<Blob>("b");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.size).toBe(new TextEncoder().encode("xin chào").length);
    expect(await blob?.text()).toBe("xin chào");
  });

  it("là bản sao: sửa đối tượng gốc sau khi ghi, hoặc sửa bản đọc ra, không ảnh hưởng dữ liệu đã lưu", async () => {
    const store = create();
    const value = { list: [1, 2] };
    await store.set("c", value);
    value.list.push(3);
    const first = await store.get<{ list: number[] }>("c");
    expect(first?.list).toEqual([1, 2]);
    first?.list.push(9);
    expect((await store.get<{ list: number[] }>("c"))?.list).toEqual([1, 2]);
  });
});

describe("IdbKeyValueStore lỗi", () => {
  it("mở kết nối lỗi thì báo tiếng Việt và lần sau thử lại được", async () => {
    let attempts = 0;
    const real = new IDBFactory() as unknown as IDBFactory;
    const flaky = {
      open(name: string, version?: number) {
        attempts++;
        if (attempts === 1) {
          const request: { onerror?: () => void } = {};
          queueMicrotask(() => request.onerror?.());
          return request;
        }
        return real.open(name, version);
      },
    } as unknown as IDBFactory;
    const store = new IdbKeyValueStore(flaky);
    await expect(store.get("k")).rejects.toThrow("Không mở được bộ nhớ trình duyệt");
    await store.set("k", 7);
    expect(await store.get("k")).toBe(7);
  });

  it("hai kho khác tên cơ sở dữ liệu không thấy dữ liệu của nhau", async () => {
    const factory = new IDBFactory() as unknown as IDBFactory;
    const a = new IdbKeyValueStore(factory, "db-a");
    const b = new IdbKeyValueStore(factory, "db-b");
    await a.set("k", 1);
    expect(await b.get("k")).toBeUndefined();
  });
});
