import { ValidationError } from "./errors";

export type SceneRole = "intro" | "body";

export class Scene {
  private constructor(
    readonly id: string,
    readonly text: string,
    readonly role: SceneRole,
  ) {}

  static create(id: string, text: string, role: SceneRole): Scene {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!id) throw new ValidationError("Cảnh thiếu id");
    if (!clean) throw new ValidationError("Nội dung cảnh không được trống");
    return new Scene(id, clean, role);
  }

  withText(text: string): Scene {
    return Scene.create(this.id, text, this.role);
  }
}
