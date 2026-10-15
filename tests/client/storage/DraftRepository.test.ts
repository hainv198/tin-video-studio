import { describe, expect, it } from "vitest";
import { DraftRepository } from "@/client/storage/DraftRepository";
import { MemoryKeyValueStore } from "@/client/storage/KeyValueStore";
import type { DraftBody } from "@/client/storage/ProjectDraft";

const body: DraftBody = {
  project: {
    title: "T.",
    sourceCredit: "",
    publishDate: "2026-10-14",
    templateId: "theanh28",
    scenes: [
      { id: "s1", text: "T.", role: "intro" },
      { id: "s2", text: "A.", role: "body" },
    ],
  },
  voice: null,
  narrations: [],
  footage: { assignments: [] },
  music: null,
};

describe("DraftRepository", () => {
  it("chưa lưu thì load trả null", async () => {
    expect(await new DraftRepository(new MemoryKeyValueStore()).load()).toBeNull();
  });

  it("save rồi load: thêm version và savedAt", async () => {
    const repo = new DraftRepository(new MemoryKeyValueStore(), () => new Date("2026-10-15T01:02:03.000Z"));
    await repo.save(body);
    expect(await repo.load()).toEqual({ version: 1, savedAt: "2026-10-15T01:02:03.000Z", ...body });
  });

  it("save ghi đè bản cũ; clear xoá hẳn", async () => {
    const repo = new DraftRepository(new MemoryKeyValueStore());
    await repo.save(body);
    await repo.save({ ...body, project: { ...body.project, title: "Mới." } });
    expect((await repo.load())?.project.title).toBe("Mới.");
    await repo.clear();
    expect(await repo.load()).toBeNull();
  });

  it("bản nháp sai phiên bản hoặc không phải đối tượng thì load trả null, không ném", async () => {
    const store = new MemoryKeyValueStore();
    const repo = new DraftRepository(store);
    await store.set("draft", { version: 99, ...body });
    expect(await repo.load()).toBeNull();
    await store.set("draft", "rác");
    expect(await repo.load()).toBeNull();
    await store.set("draft", { version: 1 });
    expect(await repo.load()).toBeNull();
  });
});
