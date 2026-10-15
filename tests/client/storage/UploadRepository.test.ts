import { describe, expect, it } from "vitest";
import { MemoryKeyValueStore } from "@/client/storage/KeyValueStore";
import { UploadRepository } from "@/client/storage/UploadRepository";
import { sequentialIds } from "@/domain/ids";

const make = () => {
  let tick = 0;
  return new UploadRepository(new MemoryKeyValueStore(), sequentialIds("u"), () => new Date(Date.UTC(2026, 9, 15, 0, 0, tick++)));
};

describe("UploadRepository", () => {
  it("put trả metadata, get trả lại đúng blob", async () => {
    const repo = make();
    const meta = await repo.put(new Blob(["hello"], { type: "image/png" }), { name: "a.png", kind: "image" });
    expect(meta).toEqual({ id: "upload-u1", name: "a.png", kind: "image", size: 5, addedAt: "2026-10-15T00:00:00.000Z" });
    const stored = await repo.get(meta.id);
    expect(stored?.name).toBe("a.png");
    expect(await stored?.blob.text()).toBe("hello");
  });

  it("get id không có trả null; delete xoá được", async () => {
    const repo = make();
    expect(await repo.get("upload-zzz")).toBeNull();
    const meta = await repo.put(new Blob(["x"]), { name: "x.mp3", kind: "audio" });
    await repo.delete(meta.id);
    expect(await repo.get(meta.id)).toBeNull();
    await repo.delete(meta.id); // xoá lần nữa không lỗi
  });

  it("list chỉ trả metadata, theo thứ tự thêm; totalBytes cộng dung lượng", async () => {
    const repo = make();
    await repo.put(new Blob(["12345"]), { name: "a", kind: "image" });
    await repo.put(new Blob(["123"]), { name: "b", kind: "video" });
    const list = await repo.list();
    expect(list.map((m) => m.name)).toEqual(["a", "b"]);
    expect(list.every((m) => !("blob" in m))).toBe(true);
    expect(await repo.totalBytes()).toBe(8);
  });

  it("không lẫn với các khoá khác trong cùng kho", async () => {
    const store = new MemoryKeyValueStore();
    await store.set("draft", { x: 1 });
    await store.set("brand:t", { y: 2 });
    const repo = new UploadRepository(store, sequentialIds("u"));
    await repo.put(new Blob(["z"]), { name: "z", kind: "image" });
    expect((await repo.list()).map((m) => m.name)).toEqual(["z"]);
  });
});
