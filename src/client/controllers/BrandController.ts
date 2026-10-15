import { BrandKit, type BrandFieldSpec } from "@/domain/BrandKit";
import { ValidationError } from "@/domain/errors";
import { classifyUpload } from "@/client/media/UploadValidator";
import type { BrandRepository } from "@/client/storage/BrandRepository";
import type { TemplateRegistry } from "@/templates/TemplateRegistry";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

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
  constructor(private readonly deps: BrandControllerDeps) {
    super({ templateId: "", specs: [], values: {}, logo: null, error: null, saved: false }, deps.onAuthLost);
  }

  async load(templateId: string): Promise<void> {
    try {
      const specs = this.deps.templates.get(templateId).brandFields;
      const stored = await this.deps.brands.load(templateId);
      const defaults = Object.fromEntries(specs.flatMap((s) => (s.defaultValue ? [[s.key, s.defaultValue]] : [])));
      const values = { ...defaults, ...(stored?.values ?? {}) };
      this.set({ templateId, specs, values, logo: stored?.logo ?? null, error: null, saved: stored !== null });
      this.push();
    } catch (error) {
      this.patch({ error: this.report(error) });
    }
  }

  setValue(key: string, value: string): void {
    this.patch({ values: { ...this.state.values, [key]: value }, saved: false });
    this.push();
  }

  setLogo(file: File): void {
    try {
      classifyUpload(file, ["image"]);
      if (file.size > MAX_LOGO_BYTES) throw new ValidationError("Logo tối đa 5 MB");
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
  private push(): void {
    try {
      const kit = this.validate();
      this.deps.session.setBrand({ values: kit.toJSON().values, logo: this.state.logo });
      this.patch({ error: null });
    } catch (error) {
      this.patch({ error: this.report(error) });
    }
  }
}
