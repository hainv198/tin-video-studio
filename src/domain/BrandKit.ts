import { ValidationError } from "./errors";

export type BrandFieldType = "text" | "color" | "image" | "number";

export interface BrandFieldSpec {
  key: string;
  label: string;
  type: BrandFieldType;
  required: boolean;
  defaultValue?: string;
  maxLength?: number;
  min?: number;
  max?: number;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const INTEGER = /^\d+$/;

export class BrandKit {
  private constructor(
    readonly templateId: string,
    private readonly values: Readonly<Record<string, string>>,
  ) {}

  static create(
    templateId: string,
    specs: readonly BrandFieldSpec[],
    values: Record<string, string | undefined>,
  ): BrandKit {
    if (!templateId) throw new ValidationError("Bộ thương hiệu thiếu phong cách");
    const clean: Record<string, string> = {};
    for (const spec of specs) {
      const value = values[spec.key]?.trim() || spec.defaultValue;
      if (!value) {
        if (spec.required) throw new ValidationError(`Thiếu ${spec.label}`);
        continue;
      }
      if (spec.type === "color" && !HEX_COLOR.test(value)) {
        throw new ValidationError(`${spec.label} phải có dạng #RRGGBB`);
      }
      if (spec.maxLength !== undefined && value.length > spec.maxLength) {
        throw new ValidationError(`${spec.label} tối đa ${spec.maxLength} ký tự`);
      }
      if (spec.type === "number") {
        const n = Number(value);
        if (!INTEGER.test(value) || n < (spec.min ?? 0) || n > (spec.max ?? Number.MAX_SAFE_INTEGER)) {
          throw new ValidationError(`${spec.label} phải là số từ ${spec.min ?? 0} đến ${spec.max ?? "tối đa"}`);
        }
        clean[spec.key] = String(n);
        continue;
      }
      clean[spec.key] = value;
    }
    return new BrandKit(templateId, clean);
  }

  get(key: string): string | undefined {
    return this.values[key];
  }

  toJSON(): { templateId: string; values: Record<string, string> } {
    return { templateId: this.templateId, values: { ...this.values } };
  }
}
