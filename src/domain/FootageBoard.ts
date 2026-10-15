import { FallbackFootage, type Footage } from "./Footage";

export class FootageBoard {
  private constructor(private readonly bySceneId: ReadonlyMap<string, Footage>) {}

  static empty(): FootageBoard {
    return new FootageBoard(new Map());
  }

  get(sceneId: string): Footage | undefined {
    return this.bySceneId.get(sceneId);
  }

  resolve(sceneId: string): Footage {
    return this.get(sceneId) ?? new FallbackFootage(`fallback-${sceneId}`);
  }

  assign(sceneId: string, footage: Footage): FootageBoard {
    const next = new Map(this.bySceneId);
    next.set(sceneId, footage);
    return new FootageBoard(next);
  }

  unassign(sceneId: string): FootageBoard {
    const next = new Map(this.bySceneId);
    next.delete(sceneId);
    return new FootageBoard(next);
  }

  swap(a: string, b: string): FootageBoard {
    const next = new Map(this.bySceneId);
    const fa = this.get(a);
    const fb = this.get(b);
    if (fb) next.set(a, fb);
    else next.delete(a);
    if (fa) next.set(b, fa);
    else next.delete(b);
    return new FootageBoard(next);
  }

  fillInOrder(sceneIds: readonly string[], footages: readonly Footage[]): FootageBoard {
    const next = new Map(this.bySceneId);
    const queue = [...footages];
    for (const sceneId of sceneIds) {
      if (next.has(sceneId)) continue;
      const footage = queue.shift();
      if (!footage) break;
      next.set(sceneId, footage);
    }
    return new FootageBoard(next);
  }

  unassignedSceneIds(sceneIds: readonly string[]): string[] {
    return sceneIds.filter((id) => !this.bySceneId.has(id));
  }
}
