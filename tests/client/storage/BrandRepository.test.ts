import { describe, expect, it } from "vitest";
import { BrandRepository } from "@/client/storage/BrandRepository";
import { MemoryKeyValueStore } from "@/client/storage/KeyValueStore";
import { ValidationError } from "@/domain/errors";

describe("BrandRepository", () => {
  it("chưa lưu thì load trả null", async () => {
    expect(await new BrandRepository(new MemoryKeyValueStore()).load("theanh28")).toBeNull();
  });

  it("lưu giá trị và logo theo từng phong cách, không lẫn nhau", async () => {
    const repo = new BrandRepository(new MemoryKeyValueStore(), () => new Date("2026-10-15T00:00:00.000Z"));
    const logo = new Blob(["png"], { type: "image/png" });
    await repo.save("theanh28", { channelName: "2NV News", primaryColor: "#1F9D55" }, logo);
    await repo.save("khac", { channelName: "Khác" }, null);
    const a = await repo.load("theanh28");
    expect(a?.values).toEqual({ channelName: "2NV News", primaryColor: "#1F9D55" });
    expect(a?.logo?.size).toBe(3);
    expect(a?.updatedAt).toBe("2026-10-15T00:00:00.000Z");
    expect((await repo.load("khac"))?.logo).toBeNull();
  });

  it("chỉ giữ giá trị chuỗi", async () => {
    const repo = new BrandRepository(new MemoryKeyValueStore());
    await repo.save("t", { a: "x", b: 5 as unknown as string }, null);
    expect((await repo.load("t"))?.values).toEqual({ a: "x" });
  });

  it("logo quá 5 MB hoặc thiếu phong cách thì ném ValidationError", async () => {
    const repo = new BrandRepository(new MemoryKeyValueStore());
    const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]);
    await expect(repo.save("t", {}, big)).rejects.toThrow("Logo tối đa 5 MB");
    await expect(repo.save("", {}, null)).rejects.toBeInstanceOf(ValidationError);
  });

  it("dữ liệu lưu hỏng thì load trả null", async () => {
    const store = new MemoryKeyValueStore();
    await store.set("brand:t", "rác");
    expect(await new BrandRepository(store).load("t")).toBeNull();
  });

  it("load lọc values về chuỗi và updatedAt luôn là chuỗi", async () => {
    const store = new MemoryKeyValueStore();
    await store.set("brand:t", { values: { a: "x", b: 5, c: null }, logo: null, updatedAt: 123 });
    const brand = await new BrandRepository(store).load("t");
    expect(brand?.values).toEqual({ a: "x" });
    expect(brand?.updatedAt).toBe("");
  });
});

describe("BrandRepository — banner chân", () => {
  it("lưu và nạp banner cạnh logo; không truyền banner thì bản lưu không có khoá banner", async () => {
    const store = new MemoryKeyValueStore();
    const repo = new BrandRepository(store);
    const banner = new Blob(["banner"], { type: "image/png" });
    await repo.save("theanh28-banner", { channelName: "A" }, null, banner);
    expect((await repo.load("theanh28-banner"))?.banner?.size).toBe(6);
    await repo.save("theanh28", { channelName: "A" }, null);
    const raw = await store.get<Record<string, unknown>>("brand:theanh28");
    expect(raw !== null && raw !== undefined && "banner" in raw).toBe(false);
    expect((await repo.load("theanh28"))?.banner).toBeUndefined();
  });

  it("banner quá 5 MB thì ném ValidationError", async () => {
    const repo = new BrandRepository(new MemoryKeyValueStore());
    const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]);
    await expect(repo.save("t", {}, null, big)).rejects.toThrow("Banner tối đa 5 MB");
  });
});
