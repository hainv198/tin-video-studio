import { describe, expect, it } from "vitest";
import { renderSummary } from "@/client/controllers/renderSummary";
import { EMPTY_STUDIO } from "@/client/controllers/StudioSession";
import { MusicTrack } from "@/domain/MusicTrack";
import { fakeNarration, makeClip, makeProject, makeUploadProject, VOICE } from "../../helpers/studioFixtures";

describe("renderSummary", () => {
  it("kiểu tin: giữ đúng câu cũ", () => {
    const project = makeProject(2);
    const d = { ...EMPTY_STUDIO, project, voice: VOICE, narrations: new Map(project.scenes.map((s) => [s.id, fakeNarration(s)])) };
    expect(renderSummary(d)).toBe("3 cảnh, giọng gốc khoảng 5 giây, nhạc: không dùng.");
  });

  it("kiểu tải lên: thẻ tiêu đề + video, tiếng gốc, không phụ đề, nhạc", () => {
    const project = makeUploadProject();
    const music = MusicTrack.create({ id: "m1", title: "Bản tin", origin: "library", uri: "/music/a.mp3" });
    const d = {
      ...EMPTY_STUDIO,
      kind: "upload" as const,
      project,
      voice: VOICE,
      narrations: new Map([["s1", fakeNarration(project.introScene, VOICE, 2.4)]]),
      sourceClip: makeClip({ durationSec: 65, volumePercent: 80 }),
      music,
    };
    expect(renderSummary(d)).toBe("Thẻ tiêu đề (giọng khoảng 2.4 giây) + video 1:05 (tiếng gốc 80%), không phụ đề, nhạc: Bản tin.");
    expect(renderSummary({ ...d, sourceClip: makeClip({ volumePercent: 0 }) })).toContain("(tắt tiếng gốc)");
    expect(renderSummary({ ...d, sourceClip: makeClip({ hasAudio: false }) })).toContain("(không có tiếng gốc)");
    expect(renderSummary({ ...d, sourceClip: null })).toBe("Chưa có video tải lên, nhạc: Bản tin.");
  });

  it("chưa có dự án: chuỗi rỗng", () => {
    expect(renderSummary(EMPTY_STUDIO)).toBe("");
  });
});
