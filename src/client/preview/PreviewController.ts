import { StateController } from "@/client/controllers/StateController";
import type { StudioSession } from "@/client/controllers/StudioSession";
import type { BackdropMaker } from "@/client/render/BackdropMaker";
import type { Canvas2D } from "@/templates/Canvas2D";
import { fontFacesFor } from "@/templates/fonts/FontCatalog";
import type { TemplateRegistry } from "@/templates/TemplateRegistry";
import type { DrawableImage, FontFaceSpec } from "@/templates/VideoTemplate";
import { buildPreviewFrames, type PreviewForm, type PreviewTab } from "./PreviewFrameBuilder";

export interface PreviewState {
  tab: PreviewTab;
  usingSample: boolean;
  error: string | null;
  /** Số lần đã vẽ (để view/e2e biết khung đã đổi). */
  drawCount: number;
}

export interface DecodedImage {
  image: DrawableImage;
  dispose(): void;
}

/** Nơi vẽ: context 1080×1920, ảnh minh hoạ, và bộ làm nền mờ như khi dựng (không bắt buộc). */
export interface PreviewSurface {
  ctx: Canvas2D;
  placeholder: DrawableImage | null;
  backdrop?: BackdropMaker | null;
}

export interface PreviewControllerDeps {
  session: Pick<StudioSession, "state" | "subscribe">;
  templates: Pick<TemplateRegistry, "get">;
  /** Hẹn chạy `fn` sau `ms`; trả hàm huỷ hẹn. */
  schedule: (fn: () => void, ms: number) => () => void;
  /** Nạp các mặt font (document.fonts ở luồng chính). */
  loadFonts: (faces: readonly FontFaceSpec[]) => Promise<void>;
  decodeImage: (blob: Blob) => Promise<DecodedImage>;
  /** Tải ảnh theo URL tương đối của trang (banner mặc định của phong cách). Bỏ trống = không vẽ banner mặc định. */
  loadImageUrl?: (url: string) => Promise<DecodedImage>;
  debounceMs?: number;
  onAuthLost?: () => void;
}

const DEFAULT_DEBOUNCE_MS = 150;
const FONT_ERROR = "Không nạp được font, xem trước đang dùng font thay thế";
const BANNER_ERROR = "Không nạp được ảnh banner, xem trước để trống dải banner";

/** Xem trước sống ở bước 1: vẽ một khung bằng đúng template của video xuất, chỉ khi dữ liệu đổi. */
export class PreviewController extends StateController<PreviewState> {
  private form: PreviewForm | null = null;
  private surface: PreviewSurface | null = null;
  private unsubscribe: (() => void) | null = null;
  private cancelPending: (() => void) | null = null;
  /** Tăng mỗi lượt vẽ và khi tháo; lượt async cũ thấy lệch thì bỏ. */
  private generation = 0;
  private lastKey: string | null = null;
  private lastLogoBlob: Blob | null = null;
  private lastBannerBlob: Blob | null = null;
  private image: DrawableImage | null = null;
  private imageVersion = 0;
  private logo: { blob: Blob; decoded: DecodedImage } | null = null;
  /** Banner đã giải mã, theo blob riêng hoặc URL mặc định (giữ lại giữa các lượt vẽ). */
  private banner: { key: Blob | string; decoded: DecodedImage } | null = null;
  /** URL font đã nạp (hoặc đã thử mà lỗi): không nạp lại. */
  private readonly fontUrls = new Set<string>();

  constructor(private readonly deps: PreviewControllerDeps) {
    super({ tab: "intro", usingSample: false, error: null, drawCount: 0 }, deps.onAuthLost);
  }

  /** Gắn vào canvas; trả hàm tháo (huỷ lượt chờ, bỏ lượt đang chạy, nhả logo). */
  attach(surface: PreviewSurface): () => void {
    this.detach();
    this.surface = surface;
    this.lastKey = null;
    this.unsubscribe = this.deps.session.subscribe(() => this.request());
    this.request();
    return () => {
      if (this.surface === surface) this.detach();
    };
  }

  setForm(form: PreviewForm): void {
    this.form = form;
    this.request();
  }

  setTab(tab: PreviewTab): void {
    if (tab === this.state.tab) return;
    this.patch({ tab });
    this.request(0);
  }

  /** Ảnh thật thay ảnh minh hoạ (ví dụ khung của video tải lên); null = về ảnh minh hoạ. */
  setImage(image: DrawableImage | null): void {
    if (image === this.image) return;
    this.image = image;
    this.imageVersion += 1;
    this.request(0);
  }

  private detach(): void {
    this.cancel();
    this.generation += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.surface = null;
    this.logo?.decoded.dispose();
    this.logo = null;
    this.dropBanner();
  }

  private cancel(): void {
    this.cancelPending?.();
    this.cancelPending = null;
  }

  private request(ms = this.deps.debounceMs ?? DEFAULT_DEBOUNCE_MS): void {
    if (!this.surface || !this.form) return;
    this.cancel();
    this.cancelPending = this.deps.schedule(() => {
      this.cancelPending = null;
      void this.draw();
    }, ms);
  }

  private async draw(): Promise<void> {
    const surface = this.surface;
    const form = this.form;
    if (!surface || !form) return;
    const { brand, options } = this.deps.session.state;
    const snapshot = options.snapshot();
    const key = JSON.stringify({ tab: this.state.tab, form, brand: brand.values, options: snapshot, image: this.imageVersion });
    const bannerBlob = brand.banner ?? null;
    if (key === this.lastKey && brand.logo === this.lastLogoBlob && bannerBlob === this.lastBannerBlob) return;
    const token = ++this.generation;
    const live = () => token === this.generation && this.surface === surface;

    let template;
    try {
      template = this.deps.templates.get(form.templateId);
    } catch (error) {
      this.patch({ error: this.report(error) });
      return;
    }

    let error: string | null = null;
    const missing = fontFacesFor(snapshot).filter((f) => !this.fontUrls.has(f.url));
    if (missing.length > 0) {
      try {
        await this.deps.loadFonts(missing);
      } catch {
        error = FONT_ERROR;
      }
      for (const f of missing) this.fontUrls.add(f.url);
      if (!live()) return;
    }

    const logo = await this.logoFor(brand.logo, live);
    if (logo === undefined) return;

    const banner = await this.bannerFor(template.footerBanner?.defaultUrl ?? null, bannerBlob, live);
    if (banner === undefined) return;
    if (banner.failed && error === null) error = BANNER_ERROR;

    const frames = buildPreviewFrames({
      form,
      template,
      brandValues: brand.values,
      options: snapshot,
      logo,
      image: this.image ?? surface.placeholder,
      ...(banner.image ? { banner: banner.image } : {}),
    });
    const scene = this.state.tab === "intro" ? frames.intro : frames.body;
    const backdrop = scene.role === "body" && scene.image && surface.backdrop ? surface.backdrop.make(scene.image) : null;
    template.drawFrame(surface.ctx, frames.project, { ...scene, backdrop });
    this.lastKey = key;
    this.lastLogoBlob = brand.logo;
    this.lastBannerBlob = bannerBlob;
    this.patch({ usingSample: frames.usingSample, error, drawCount: this.state.drawCount + 1 });
  }

  /** Logo đã giải mã cho `blob` (giữ lại giữa các lượt vẽ). `undefined` = lượt vẽ đã bị bỏ. */
  private async logoFor(blob: Blob | null, live: () => boolean): Promise<DrawableImage | null | undefined> {
    if (this.logo?.blob === blob) return this.logo.decoded.image;
    let decoded: DecodedImage | null = null;
    if (blob) {
      try {
        decoded = await this.deps.decodeImage(blob);
      } catch {
        decoded = null;
      }
      if (!live()) {
        decoded?.dispose();
        return undefined;
      }
    }
    this.logo?.decoded.dispose();
    this.logo = blob && decoded ? { blob, decoded } : null;
    return decoded?.image ?? null;
  }

  /**
   * Banner của phong cách (null khi phong cách không có banner): ảnh riêng trong thương hiệu, không có thì ảnh mặc định.
   * `undefined` = lượt vẽ đã bị bỏ. Lỗi nạp không giữ vào bộ đệm (lượt sau thử lại).
   */
  private async bannerFor(
    defaultUrl: string | null,
    blob: Blob | null,
    live: () => boolean,
  ): Promise<{ image: DrawableImage | null; failed: boolean } | undefined> {
    if (!defaultUrl) {
      this.dropBanner();
      return { image: null, failed: false };
    }
    const key: Blob | string = blob ?? defaultUrl;
    if (this.banner?.key === key) return { image: this.banner.decoded.image, failed: false };
    const loadUrl = this.deps.loadImageUrl;
    const loader = blob ? () => this.deps.decodeImage(blob) : loadUrl ? () => loadUrl(defaultUrl) : null;
    let decoded: DecodedImage | null = null;
    if (loader) {
      try {
        decoded = await loader();
      } catch {
        decoded = null;
      }
      if (!live()) {
        decoded?.dispose();
        return undefined;
      }
    }
    this.dropBanner();
    if (decoded) this.banner = { key, decoded };
    return { image: decoded?.image ?? null, failed: loader !== null && decoded === null };
  }

  private dropBanner(): void {
    this.banner?.decoded.dispose();
    this.banner = null;
  }
}
