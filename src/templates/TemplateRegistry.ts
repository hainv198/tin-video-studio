import { NotFoundError } from "@/domain/errors";
import type { VideoTemplate } from "./VideoTemplate";

export class TemplateRegistry {
  private readonly byId = new Map<string, VideoTemplate>();

  constructor(templates: readonly VideoTemplate[]) {
    for (const t of templates) {
      if (this.byId.has(t.id)) throw new Error(`Trùng phong cách ${t.id}`);
      this.byId.set(t.id, t);
    }
  }

  get(id: string): VideoTemplate {
    const t = this.byId.get(id);
    if (!t) throw new NotFoundError(`Không có phong cách ${id}`);
    return t;
  }

  list(): { id: string; name: string }[] {
    return [...this.byId.values()].map((t) => ({ id: t.id, name: t.name }));
  }
}
