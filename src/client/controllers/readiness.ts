import type { StudioData } from "./StudioSession";

export type StepId = "news" | "voice" | "footage" | "music" | "render";

export const STEPS: readonly { id: StepId; label: string }[] = [
  { id: "news", label: "Nhập tin" },
  { id: "voice", label: "Chọn giọng" },
  { id: "footage", label: "Cảnh trám" },
  { id: "music", label: "Nhạc nền" },
  { id: "render", label: "Dựng video" },
];

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

export function stepReady(step: StepId, data: StudioData): boolean {
  switch (step) {
    case "news":
      return data.project !== null;
    case "voice":
      return data.project !== null && data.voice !== null && staleSceneIds(data).length === 0;
    case "footage":
    case "music":
      // Cảnh trống dùng nền mặc định; không nhạc cũng được.
      return stepReady("voice", data);
    case "render":
      return stepReady("music", data);
  }
}

/** Vào được bước `step` khi mọi bước đứng trước đã sẵn sàng. */
export function canEnter(step: StepId, data: StudioData): boolean {
  const index = STEPS.findIndex((s) => s.id === step);
  return STEPS.slice(0, index).every((s) => stepReady(s.id, data));
}

/** Bước đầu tiên chưa xong; khi giọng đã đủ thì là "render" (bước 3-4 không bắt buộc). */
export function firstIncompleteStep(data: StudioData): StepId {
  const pending = STEPS.find((s) => s.id !== "render" && !stepReady(s.id, data));
  return pending ? pending.id : "render";
}
