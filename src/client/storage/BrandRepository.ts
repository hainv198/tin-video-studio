import { ValidationError } from "@/domain/errors";
import { FOOTER_BANNER_LIMITS } from "@/domain/FooterBanner";
import type { KeyValueStore } from "./KeyValueStore";

export const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export interface StoredBrand {
  values: Record<string, string>;
  logo: Blob | null;
  /** Banner chân riêng (phong cách có banner); không có khoá = dùng banner mặc định. */
  banner?: Blob;
  updatedAt: string;
}

export class BrandRepository {
  constructor(
    private readonly store: KeyValueStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async save(templateId: string, values: Record<string, string>, logo: Blob | null, banner: Blob | null = null): Promise<void> {
    if (!templateId) throw new ValidationError("Chưa chọn phong cách video");
    if (logo && logo.size > MAX_LOGO_BYTES) throw new ValidationError("Logo tối đa 5 MB");
    if (banner && banner.size > FOOTER_BANNER_LIMITS.maxBytes) throw new ValidationError("Banner tối đa 5 MB");
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) if (typeof value === "string") clean[key] = value;
    const stored: StoredBrand = { values: clean, logo, ...(banner ? { banner } : {}), updatedAt: this.now().toISOString() };
    await this.store.set(`brand:${templateId}`, stored);
  }

  async load(templateId: string): Promise<StoredBrand | null> {
    const value = await this.store.get<unknown>(`brand:${templateId}`);
    if (typeof value !== "object" || value === null) return null;
    const brand = value as Partial<StoredBrand>;
    if (typeof brand.values !== "object" || brand.values === null) return null;
    const values: Record<string, string> = {};
    for (const [key, v] of Object.entries(brand.values)) if (typeof v === "string") values[key] = v;
    return {
      values,
      logo: brand.logo instanceof Blob ? brand.logo : null,
      ...(brand.banner instanceof Blob ? { banner: brand.banner } : {}),
      updatedAt: typeof brand.updatedAt === "string" ? brand.updatedAt : "",
    };
  }
}
