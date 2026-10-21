import { BrandKit, type BrandFieldSpec } from "@/domain/BrandKit";
import { ValidationError } from "@/domain/errors";
import { checkFooterBanner, FOOTER_BANNER_LIMITS } from "@/domain/FooterBanner";
import { classifyUpload } from "@/client/media/UploadValidator";
import { MAX_LOGO_BYTES, type BrandRepository } from "@/client/storage/BrandRepository";
import type { TemplateRegistry } from "@/templates/TemplateRegistry";
import type { VideoTemplate } from "@/templates/VideoTemplate";
import { StateController } from "./StateController";
import type { BrandData, StudioSession } from "./StudioSession";

export interface BrandPanelState {
  templateId: string;
  specs: readonly BrandFieldSpec[];
  values: Record<string, string>;
  logo: Blob | null;
  /** Banner chân riêng; không có = banner mặc định của phong cách. */
  banner?: Blob;
  error: string | null;
  saved: boolean;
}

export interface BrandControllerDeps {
  session: StudioSession;
  templates: TemplateRegistry;
  brands: Pick<BrandRepository, "load" | "save">;
  onAuthLost?: () => void;
  /** Đo kích thước ảnh (mặc định createImageBitmap của trình duyệt); tiêm được để test. */
  measureImage?: (blob: Blob) => Promise<{ width: number; height: number }>;
}

async function measureWithBitmap(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

/** Bộ thương hiệu của một phong cách: tên kênh, màu, logo, banner chân (nếu phong cách có). */
export class BrandController extends StateController<BrandPanelState> {
  private loadToken = 0;
  private bannerToken = 0;

  constructor(private readonly deps: BrandControllerDeps) {
    super({ templateId: "", specs: [], values: {}, logo: null, error: null, saved: false }, deps.onAuthLost);
  }

  async load(templateId: string): Promise<void> {
    if (this.state.templateId === templateId && this.state.specs.length > 0 && !this.state.error) {
      // Đã nạp phong cách này: giữ nguyên chỉnh sửa chưa lưu, chỉ đảm bảo session có giá trị hiện tại.
      this.push();
      return;
    }
    const token = ++this.loadToken;
    let template: VideoTemplate;
    try {
      template = this.deps.templates.get(templateId);
    } catch (error) {
      this.set({ templateId, specs: [], values: {}, logo: null, error: this.report(error), saved: false });
      this.deps.session.setBrand({ values: {}, logo: null });
      return;
    }
    const specs = template.brandFields;
    try {
      const own = await this.deps.brands.load(templateId);
      // Chưa lưu riêng: mượn tên kênh, màu, logo của phong cách gốc (vẫn tính là chưa lưu; banner không mượn).
      const fallbackId = template.brandFallbackId;
      const stored = own ?? (fallbackId ? await this.deps.brands.load(fallbackId) : null);
      if (token !== this.loadToken) return;
      const defaults = Object.fromEntries(specs.flatMap((s) => (s.defaultValue ? [[s.key, s.defaultValue]] : [])));
      const values = { ...defaults, ...(stored?.values ?? {}) };
      const banner = own?.banner;
      this.set({ templateId, specs, values, logo: stored?.logo ?? null, ...(banner ? { banner } : {}), error: null, saved: own !== null });
      if (!this.push()) {
        // Giá trị đã lưu sai: panel giữ nguyên để sửa, session dùng mặc định của phong cách này.
        const kit = BrandKit.create(templateId, specs, {});
        this.deps.session.setBrand({ values: kit.toJSON().values, logo: null });
      }
    } catch (error) {
      if (token !== this.loadToken) return;
      this.patch({ error: this.report(error) });
    }
  }

  setValue(key: string, value: string): void {
    this.patch({ values: { ...this.state.values, [key]: value }, saved: false });
    this.push();
  }

  setLogo(file: File): void {
    try {
      if (file.size > MAX_LOGO_BYTES) throw new ValidationError("Logo tối đa 5 MB");
      classifyUpload(file, ["image"]);
    } catch (error) {
      this.patch({ error: this.report(error) });
      return;
    }
    this.patch({ logo: file, saved: false });
    this.push();
  }

  clearLogo(): void {
    this.patch({ logo: null, saved: false });
    this.push();
  }

  /** Banner chân riêng: kiểm định dạng, dung lượng, kích thước/tỉ lệ (đọc ảnh), rồi mới nhận. Lỗi thì giữ banner cũ. */
  async setBanner(file: File): Promise<void> {
    const token = ++this.bannerToken;
    try {
      if (file.size > FOOTER_BANNER_LIMITS.maxBytes) throw new ValidationError("Banner tối đa 5 MB");
      classifyUpload(file, ["image"]);
      const measure = this.deps.measureImage ?? measureWithBitmap;
      const size = await measure(file).catch((): never => {
        throw new ValidationError("Không đọc được ảnh banner");
      });
      checkFooterBanner(size.width, size.height);
    } catch (error) {
      if (token === this.bannerToken) this.patch({ error: this.report(error) });
      return;
    }
    if (token !== this.bannerToken) return;
    this.patch({ banner: file, saved: false });
    this.push();
  }

  /** "Dùng banner mặc định": bỏ banner riêng. */
  clearBanner(): void {
    this.bannerToken += 1;
    this.patch({ banner: undefined, saved: false });
    this.push();
  }

  async save(): Promise<boolean> {
    try {
      const kit = this.validate();
      await this.deps.brands.save(this.state.templateId, kit.toJSON().values, this.state.logo, this.state.banner ?? null);
      this.patch({ error: null, saved: true });
      return true;
    } catch (error) {
      this.patch({ error: this.report(error) });
      return false;
    }
  }

  private validate(): BrandKit {
    return BrandKit.create(this.state.templateId, this.state.specs, this.state.values);
  }

  /** Đưa giá trị hợp lệ vào session để dựng; giá trị sai chỉ hiện lỗi, session giữ bản hợp lệ gần nhất. */
  private push(): boolean {
    try {
      const kit = this.validate();
      const brand: BrandData = {
        values: kit.toJSON().values,
        logo: this.state.logo,
        ...(this.state.banner ? { banner: this.state.banner } : {}),
      };
      this.deps.session.setBrand(brand);
      this.patch({ error: null });
      return true;
    } catch (error) {
      this.patch({ error: this.report(error), saved: false });
      return false;
    }
  }
}
