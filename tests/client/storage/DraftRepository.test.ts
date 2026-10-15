import { describe, expect, it } from "vitest";
import { DraftRepository } from "@/client/storage/DraftRepository";
import { MemoryKeyValueStore } from "@/client/storage/KeyValueStore";
import { restoreDraft, type DraftBody } from "@/client/storage/ProjectDraft";
import { sequentialIds } from "@/domain/ids";
import { Narration } from "@/domain/Narration";
import { VoiceSettings } from "@/domain/VoiceSettings";

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

  it("save ghi đè dấu version/savedAt cũ lẫn trong body đã load", async () => {
    const repo = new DraftRepository(new MemoryKeyValueStore(), () => new Date("2026-10-15T09:00:00.000Z"));
    const stale = { ...body, version: 7, savedAt: "2020-01-01T00:00:00.000Z" } as unknown as DraftBody;
    await repo.save(stale);
    const loaded = await repo.load();
    expect(loaded?.version).toBe(1);
    expect(loaded?.savedAt).toBe("2026-10-15T09:00:00.000Z");
  });

  it("round trip thật: Narration có audio Uint8Array qua repository và restoreDraft", async () => {
    const voice = VoiceSettings.create("vi-VN-HoaiMyNeural", 1);
    const narration = Narration.create({
      sceneId: "s1",
      text: "T.",
      audio: new Uint8Array([9, 8, 7]),
      mimeType: "audio/mpeg",
      durationSec: 1.5,
      voice,
    });
    const repo = new DraftRepository(new MemoryKeyValueStore());
    await repo.save({ ...body, voice: voice.snapshot(), narrations: [narration.snapshot()] });
    const loaded = await repo.load();
    const restored = restoreDraft(loaded!, sequentialIds("n"));
    const audio = restored.narrations[0]!.snapshot().audio;
    expect(audio).toBeInstanceOf(Uint8Array);
    expect(audio).toEqual(new Uint8Array([9, 8, 7]));
  });
});
