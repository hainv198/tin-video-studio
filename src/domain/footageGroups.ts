import type { SceneRole } from "./Scene";

/** Đủ để xếp nhóm cảnh trám: id và vai của đoạn, theo thứ tự trong dự án. */
export interface FootageGroupScene {
  readonly id: string;
  readonly role: SceneRole;
}

/** Đoạn được phép dùng tiếp cảnh của đoạn trước: không phải mở đầu và không đứng đầu danh sách. */
export function canContinueFootage(scenes: readonly FootageGroupScene[], sceneId: string): boolean {
  const index = scenes.findIndex((s) => s.id === sceneId);
  return index > 0 && (scenes[index] as FootageGroupScene).role !== "intro";
}

/**
 * Chủ cảnh của từng đoạn: đoạn có cảnh riêng là chủ của chính nó; đoạn "dùng tiếp" trỏ tới đoạn gần nhất
 * phía trước có cảnh riêng. Id lạ trong `continued` bị bỏ qua; mở đầu/đoạn đầu luôn có cảnh riêng.
 */
export function resolveFootageSource(
  scenes: readonly FootageGroupScene[],
  continued: ReadonlySet<string>,
): Map<string, string> {
  const owners = new Map<string, string>();
  let owner: string | null = null;
  scenes.forEach((scene, index) => {
    const continues = owner !== null && index > 0 && scene.role !== "intro" && continued.has(scene.id);
    if (!continues) owner = scene.id;
    owners.set(scene.id, owner as string);
  });
  return owners;
}

/** "Gộp mỗi 2 đoạn một cảnh": đoạn thân bài thứ 2, 4, … dùng tiếp đoạn thân bài trước nó; mở đầu giữ cảnh riêng. */
export function pairedContinuations(scenes: readonly FootageGroupScene[]): string[] {
  const body = scenes.filter((s) => s.role !== "intro");
  return body.filter((s, i) => i % 2 === 1 && canContinueFootage(scenes, s.id)).map((s) => s.id);
}
