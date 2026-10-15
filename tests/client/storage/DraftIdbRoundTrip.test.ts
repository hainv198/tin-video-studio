import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { parseUploadUri, uploadToFootage } from "@/client/media/footageFactory";
import { DraftRepository } from "@/client/storage/DraftRepository";
import { IdbKeyValueStore } from "@/client/storage/IdbKeyValueStore";
import { restoreDraft, type DraftBody } from "@/client/storage/ProjectDraft";
import { FootageBoard } from "@/domain/FootageBoard";
import { sequentialIds } from "@/domain/ids";
import { Narration } from "@/domain/Narration";
import { VoiceSettings } from "@/domain/VoiceSettings";

describe("DraftRepository qua IdbKeyValueStore", () => {
  it("lưu bản nháp đầy đủ, đóng, mở lại store mới rồi khôi phục: audio và uri upload còn nguyên", async () => {
    const factory = new IDBFactory() as unknown as IDBFactory;
    const voice = VoiceSettings.create("vi-VN-HoaiMyNeural", 1);
    const narration = Narration.create({
      sceneId: "s1",
      text: "T.",
      audio: new Uint8Array([5, 4, 3, 2, 1]),
      mimeType: "audio/mpeg",
      durationSec: 2,
      voice,
    });
    const footage = FootageBoard.empty().assign(
      "s2",
      uploadToFootage("f1", "upload-u1", "image", { width: 800, height: 600 }),
    );
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
      voice: voice.snapshot(),
      narrations: [narration.snapshot()],
      footage: footage.snapshot(),
      music: null,
    };

    const first = new IdbKeyValueStore(factory);
    await new DraftRepository(first).save(body);
    await first.close();

    const second = new IdbKeyValueStore(factory);
    const loaded = await new DraftRepository(second).load();
    expect(loaded).not.toBeNull();
    const restored = restoreDraft(loaded!, sequentialIds("n"));
    const audio = restored.narrations[0]!.snapshot().audio;
    expect(audio).toBeInstanceOf(Uint8Array);
    expect(Array.from(audio)).toEqual([5, 4, 3, 2, 1]);
    const restoredFootage = restored.footage.snapshot().assignments[0]![1];
    if (restoredFootage.kind === "fallback") throw new Error("kỳ vọng cảnh trám tải lên");
    expect(parseUploadUri(restoredFootage.source.uri)).toBe("upload-u1");
    await second.close();
  });
});
