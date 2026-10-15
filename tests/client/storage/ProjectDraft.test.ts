import { describe, expect, it } from "vitest";
import { FallbackFootage, ImageFootage } from "@/domain/Footage";
import { FootageBoard } from "@/domain/FootageBoard";
import { sequentialIds } from "@/domain/ids";
import { MusicTrack } from "@/domain/MusicTrack";
import { Narration } from "@/domain/Narration";
import { NewsProject } from "@/domain/NewsProject";
import { SentenceSplitter } from "@/domain/SentenceSplitter";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { ValidationError } from "@/domain/errors";
import { buildDraftBody, restoreDraft, type DraftParts } from "@/client/storage/ProjectDraft";

function parts(): DraftParts {
  const project = NewsProject.fromText(
    {
      text: "Tiêu đề tin. Câu thứ nhất của tin. Câu thứ hai của tin.",
      sourceCredit: "VnExpress",
      publishDate: new Date(2026, 9, 14),
      templateId: "theanh28",
    },
    new SentenceSplitter(),
    sequentialIds("s"),
  );
  const voice = VoiceSettings.create("vi-VN-HoaiMyNeural", 1.07);
  const first = project.scenes[0]!;
  return {
    project,
    voice,
    narrations: [
      Narration.create({
        sceneId: first.id,
        text: first.text,
        audio: new Uint8Array([1, 2, 3]),
        mimeType: "audio/mpeg",
        durationSec: 2.5,
        voice,
      }),
    ],
    footage: FootageBoard.empty()
      .assign("s2", new ImageFootage("f1", { origin: "upload", uri: "upload-1" }, 800, 600))
      .assign("s3", new FallbackFootage("fb")),
    music: MusicTrack.create({ id: "m1", title: "Bản tin", origin: "library", uri: "/music/ban-tin-mac-dinh.mp3" }),
  };
}

describe("buildDraftBody / restoreDraft", () => {
  it("round trip qua structuredClone giữ nguyên mọi phần", () => {
    const original = parts();
    const body = structuredClone(buildDraftBody(original));
    const back = restoreDraft(body, sequentialIds("n"));
    expect(back.project.snapshot()).toEqual(original.project.snapshot());
    expect(back.voice?.snapshot()).toEqual(original.voice?.snapshot());
    expect(back.narrations.map((n) => n.snapshot())).toEqual(original.narrations.map((n) => n.snapshot()));
    expect(back.footage.snapshot()).toEqual(original.footage.snapshot());
    expect(back.music?.snapshot()).toEqual(original.music?.snapshot());
  });

  it("chấp nhận bản nháp chưa có giọng, chưa có nhạc, chưa có cảnh trám", () => {
    const empty: DraftParts = { ...parts(), voice: null, narrations: [], footage: FootageBoard.empty(), music: null };
    const back = restoreDraft(structuredClone(buildDraftBody(empty)), sequentialIds("n"));
    expect(back.voice).toBeNull();
    expect(back.music).toBeNull();
    expect(back.narrations).toEqual([]);
    expect(back.footage.unassignedSceneIds(["s1"])).toEqual(["s1"]);
  });

  it("bản nháp hỏng ở bất kỳ phần nào thì ném ValidationError", () => {
    const body = buildDraftBody(parts());
    expect(() => restoreDraft({ ...body, project: { ...body.project, scenes: [] } }, sequentialIds("n"))).toThrow(
      ValidationError,
    );
    expect(() => restoreDraft({ ...body, voice: { voiceName: "x", speakingRate: 1 } }, sequentialIds("n"))).toThrow(
      ValidationError,
    );
    expect(() =>
      restoreDraft({ ...body, footage: { assignments: [["s2", { kind: "gif", id: "x" } as never]] } }, sequentialIds("n")),
    ).toThrow(ValidationError);
  });

  it("thiếu narrations hoặc sai kiểu container thì ném ValidationError tiếng Việt, không phải TypeError", () => {
    const body = buildDraftBody(parts());
    const { narrations: _omit, ...noNarrations } = body;
    void _omit;
    expect(() => restoreDraft(noNarrations as never, sequentialIds("n"))).toThrow(ValidationError);
    expect(() => restoreDraft(noNarrations as never, sequentialIds("n"))).toThrow(/^Bản nháp hỏng/);
    expect(() => restoreDraft({ ...body, footage: "rác" as never }, sequentialIds("n"))).toThrow(ValidationError);
    expect(() => restoreDraft({ ...body, music: "rác" as never }, sequentialIds("n"))).toThrow(ValidationError);
  });

  it("giọng đọc có audio không phải Uint8Array thì ném ValidationError", () => {
    const body = buildDraftBody(parts());
    const bad = { ...body.narrations[0]!, audio: [1, 2, 3] as never };
    expect(() => restoreDraft({ ...body, narrations: [bad] }, sequentialIds("n"))).toThrow(ValidationError);
  });
});
