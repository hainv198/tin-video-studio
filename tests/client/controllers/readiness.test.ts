import { describe, expect, it } from "vitest";
import { EMPTY_STUDIO } from "@/client/controllers/StudioSession";
import { canEnter, firstIncompleteStep, footageOwners, missingFootageSceneIds, projectKind, staleSceneIds, stepReady, STEPS, stepsOf, UPLOAD_STEPS } from "@/client/controllers/readiness";
import { FallbackFootage } from "@/domain/Footage";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { fakeNarration, makeClip, makeProject, makeUploadProject, VOICE } from "../../helpers/studioFixtures";

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

  it("cảnh thiếu chỉ đếm đoạn có cảnh trám riêng; đoạn dùng tiếp trỏ về chủ cảnh", () => {
    const d0 = withProject(); // s1 mở đầu, s2, s3
    expect(missingFootageSceneIds(d0)).toEqual(["s1", "s2", "s3"]);
    expect(Object.fromEntries(footageOwners(d0))).toEqual({ s1: "s1", s2: "s2", s3: "s3" });
    const d = { ...d0, options: d0.options.withSceneContinued("s3", true), footage: d0.footage.assign("s2", new FallbackFootage("x")) };
    expect(missingFootageSceneIds(d)).toEqual(["s1"]);
    expect(footageOwners(d).get("s3")).toBe("s2");
    expect(missingFootageSceneIds(EMPTY_STUDIO)).toEqual([]);
  });
});

describe("readiness — kiểu Video tải lên", () => {
  const upload = () => ({ ...EMPTY_STUDIO, kind: "upload" as const });

  it("chưa có dự án: bước theo kiểu đang chọn; nhãn bước 1 đổi theo kiểu", () => {
    expect(stepsOf(EMPTY_STUDIO)).toBe(STEPS);
    expect(stepsOf(upload())).toBe(UPLOAD_STEPS);
    expect(UPLOAD_STEPS.map((s) => [s.id, s.label])).toEqual([
      ["news", "Nhập tiêu đề"],
      ["clip", "Video của bạn"],
      ["voice", "Giọng tiêu đề"],
      ["music", "Nhạc nền"],
      ["render", "Dựng video"],
    ]);
    expect(canEnter("clip", upload())).toBe(false);
    expect(canEnter("clip", EMPTY_STUDIO)).toBe(false);
    expect(canEnter("footage", { ...upload(), project: makeUploadProject() })).toBe(false);
  });

  it("có dự án mà chưa có video: dừng ở bước Video của bạn", () => {
    const d = { ...upload(), project: makeUploadProject(), voice: VOICE };
    expect(projectKind(d)).toBe("upload");
    expect(canEnter("clip", d)).toBe(true);
    expect(stepReady("clip", d)).toBe(false);
    expect(canEnter("voice", d)).toBe(false);
    expect(firstIncompleteStep(d)).toBe("clip");
  });

  it("có video mà chưa giọng tiêu đề: dừng ở bước giọng; đủ giọng thì vào được Dựng", () => {
    const project = makeUploadProject();
    const d = { ...upload(), project, voice: VOICE, sourceClip: makeClip() };
    expect(canEnter("voice", d)).toBe(true);
    expect(staleSceneIds(d)).toEqual(["s1"]);
    expect(firstIncompleteStep(d)).toBe("voice");
    const ready = { ...d, narrations: new Map([["s1", fakeNarration(project.introScene)]]) };
    expect(canEnter("music", ready)).toBe(true);
    expect(canEnter("render", ready)).toBe(true);
    expect(firstIncompleteStep(ready)).toBe("render");
  });

  it("kiểu tin không có bước clip", () => {
    const d = { ...EMPTY_STUDIO, project: makeProject(2), voice: VOICE };
    expect(canEnter("clip", d)).toBe(false);
  });
});
