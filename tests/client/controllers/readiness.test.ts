import { describe, expect, it } from "vitest";
import { EMPTY_STUDIO } from "@/client/controllers/StudioSession";
import { canEnter, firstIncompleteStep, staleSceneIds, stepReady, STEPS } from "@/client/controllers/readiness";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { fakeNarration, makeProject, VOICE } from "../../helpers/studioFixtures";

const withProject = () => ({ ...EMPTY_STUDIO, project: makeProject(2), voice: VOICE });

describe("readiness", () => {
  it("5 bước theo thứ tự", () => {
    expect(STEPS.map((s) => s.id)).toEqual(["news", "voice", "footage", "music", "render"]);
  });

  it("chưa có dự án: chỉ vào được bước nhập tin", () => {
    expect(stepReady("news", EMPTY_STUDIO)).toBe(false);
    expect(canEnter("news", EMPTY_STUDIO)).toBe(true);
    expect(canEnter("voice", EMPTY_STUDIO)).toBe(false);
    expect(firstIncompleteStep(EMPTY_STUDIO)).toBe("news");
  });

  it("có dự án nhưng thiếu giọng: dừng ở bước giọng", () => {
    const d = withProject();
    expect(stepReady("news", d)).toBe(true);
    expect(stepReady("voice", d)).toBe(false);
    expect(staleSceneIds(d)).toEqual(["s1", "s2", "s3"]);
    expect(canEnter("footage", d)).toBe(false);
    expect(firstIncompleteStep(d)).toBe("voice");
  });

  it("đủ giọng thì mở tiếp các bước sau", () => {
    const d0 = withProject();
    const d = { ...d0, narrations: new Map(d0.project.scenes.map((s) => [s.id, fakeNarration(s)])) };
    expect(staleSceneIds(d)).toEqual([]);
    expect(stepReady("voice", d)).toBe(true);
    expect(canEnter("render", d)).toBe(true);
    expect(firstIncompleteStep(d)).toBe("render");
  });

  it("đổi tốc độ đọc hoặc sửa chữ làm giọng cũ đi", () => {
    const d0 = withProject();
    const narrations = new Map(d0.project.scenes.map((s) => [s.id, fakeNarration(s)]));
    const faster = { ...d0, narrations, voice: VoiceSettings.create(VOICE.voiceName, 1.2) };
    expect(staleSceneIds(faster)).toEqual(["s1", "s2", "s3"]);
    const edited = { ...d0, narrations, project: d0.project.updateSceneText("s2", "Câu đã sửa.") };
    expect(staleSceneIds(edited)).toEqual(["s2"]);
  });
});
