import { resolveFootageSource } from "@/domain/footageGroups";
import type { ProjectKind } from "@/domain/ProjectKind";
import type { StudioData } from "./StudioSession";

export type StepId = "news" | "clip" | "voice" | "footage" | "music" | "render";

export interface StepInfo {
  id: StepId;
  label: string;
}

/** Các bước của kiểu "Bản tin nhiều cảnh" (giữ nguyên như trước khi có kiểu thứ hai). */
export const STEPS: readonly StepInfo[] = [
  { id: "news", label: "Nhập tin" },
  { id: "voice", label: "Chọn giọng" },
  { id: "footage", label: "Cảnh trám" },
  { id: "music", label: "Nhạc nền" },
  { id: "render", label: "Dựng video" },
];

/** Các bước của kiểu "Video tải lên": không chia cảnh, không cảnh trám. */
export const UPLOAD_STEPS: readonly StepInfo[] = [
  { id: "news", label: "Nhập tiêu đề" },
  { id: "clip", label: "Video của bạn" },
  { id: "voice", label: "Giọng tiêu đề" },
  { id: "music", label: "Nhạc nền" },
  { id: "render", label: "Dựng video" },
];

/** Kiểu đang làm: theo dự án nếu có, không thì theo lựa chọn ở bước 1. */
export function projectKind(data: StudioData): ProjectKind {
  return data.project?.kind ?? data.kind;
}

export function stepsFor(kind: ProjectKind): readonly StepInfo[] {
  return kind === "upload" ? UPLOAD_STEPS : STEPS;
}

export function stepsOf(data: StudioData): readonly StepInfo[] {
  return stepsFor(projectKind(data));
}

/** Cảnh chưa có giọng, hoặc giọng đã cũ (sửa chữ, đổi giọng/tốc độ). */
export function staleSceneIds(data: StudioData): string[] {
  const { project, voice, narrations } = data;
  if (!project) return [];
  return project.scenes
    .filter((scene) => {
      const narration = narrations.get(scene.id);
      return !narration || !voice || narration.isStaleFor(scene, voice);
    })
    .map((scene) => scene.id);
}

/** Chủ cảnh trám của từng đoạn (đoạn "dùng tiếp" trỏ về đoạn trước có cảnh riêng). Chưa có dự án = rỗng. */
export function footageOwners(data: StudioData): Map<string, string> {
  if (!data.project) return new Map();
  return resolveFootageSource(data.project.scenes, data.options.continuedSceneIds);
}

/** Đoạn có cảnh trám riêng, theo thứ tự (đoạn dùng tiếp bị bỏ). */
export function ownFootageSceneIds(data: StudioData): string[] {
  return [...footageOwners(data)].filter(([id, owner]) => id === owner).map(([id]) => id);
}

/** Đoạn có cảnh trám riêng mà chưa gán cảnh (đoạn dùng tiếp không tính). */
export function missingFootageSceneIds(data: StudioData): string[] {
  return data.footage.unassignedSceneIds(ownFootageSceneIds(data));
}

export function stepReady(step: StepId, data: StudioData): boolean {
  switch (step) {
    case "news":
      return data.project !== null;
    case "clip":
      return data.project !== null && data.project.kind === "upload" && data.sourceClip !== null;
    case "voice": {
      const before = projectKind(data) === "upload" ? stepReady("clip", data) : data.project !== null;
      return before && data.voice !== null && staleSceneIds(data).length === 0;
    }
    case "footage":
    case "music":
      // Cảnh trống dùng nền mặc định; không nhạc cũng được.
      return stepReady("voice", data);
    case "render":
      return stepReady("music", data);
  }
}

/** Vào được bước `step` khi bước đó thuộc kiểu đang làm và mọi bước đứng trước đã sẵn sàng. */
export function canEnter(step: StepId, data: StudioData): boolean {
  const steps = stepsOf(data);
  const index = steps.findIndex((s) => s.id === step);
  if (index < 0) return false;
  return steps.slice(0, index).every((s) => stepReady(s.id, data));
}

/** Bước đầu tiên chưa xong; khi giọng đã đủ thì là "render" (cảnh trám, nhạc không bắt buộc). */
export function firstIncompleteStep(data: StudioData): StepId {
  const pending = stepsOf(data).find((s) => s.id !== "render" && !stepReady(s.id, data));
  return pending ? pending.id : "render";
}
