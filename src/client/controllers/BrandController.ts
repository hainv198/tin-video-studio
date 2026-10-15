import { BrandKit, type BrandFieldSpec } from "@/domain/BrandKit";
import { ValidationError } from "@/domain/errors";
import { classifyUpload } from "@/client/media/UploadValidator";
import { MAX_LOGO_BYTES, type BrandRepository } from "@/client/storage/BrandRepository";
import type { TemplateRegistry } from "@/templates/TemplateRegistry";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";


export interface BrandPanelState {
  templateId: string;
  specs: readonly BrandFieldSpec[];
  values: Record<string, string>;
  logo: Blob | null;
  error: string | null;
  saved: boolean;
}

export interface BrandControllerDeps {
  session: StudioSession;
  templates: TemplateRegistry;
  brands: Pick<BrandRepository, "load" | "save">;
  onAuthLost?: () => void;
}

/** Bộ thương hiệu của một phong cách: tên kênh, màu, logo. */
export class BrandController extends StateController<BrandPanelState> {
  private loadToken = 0;

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
    let specs: readonly BrandFieldSpec[];
    try {
      specs = this.deps.templates.get(templateId).brandFields;
    } catch (error) {
      this.set({ templateId, specs: [], values: {}, logo: null, error: this.report(error), saved: false });
      this.deps.session.setBrand({ values: {}, logo: null });
      return;
    }
    try {
      const stored = await this.deps.brands.load(templateId);
      if (token !== this.loadToken) return;
      const defaults = Object.fromEntries(specs.flatMap((s) => (s.defaultValue ? [[s.key, s.defaultValue]] : [])));
      const values = { ...defaults, ...(stored?.values ?? {}) };
      this.set({ templateId, specs, values, logo: stored?.logo ?? null, error: null, saved: stored !== null });
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

  async save(): Promise<boolean> {
    try {
      const kit = this.validate();
      await this.deps.brands.save(this.state.templateId, kit.toJSON().values, this.state.logo);
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
      this.deps.session.setBrand({ values: kit.toJSON().values, logo: this.state.logo });
      this.patch({ error: null });
      return true;
    } catch (error) {
      this.patch({ error: this.report(error), saved: false });
      return false;
    }
  }
}
