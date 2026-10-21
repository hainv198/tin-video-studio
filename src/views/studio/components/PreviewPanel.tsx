"use client";

import { useEffect, useRef, useState } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { loadFonts } from "@/client/media/FontLoader";
import { loadImageUrl } from "@/client/media/loadImageUrl";
import { PreviewController } from "@/client/preview/PreviewController";
import type { PreviewForm, PreviewTab } from "@/client/preview/PreviewFrameBuilder";
import { drawPlaceholder, PLACEHOLDER_SIZE } from "@/client/preview/placeholderImage";
import { CanvasBackdropMaker } from "@/client/render/BackdropMaker";
import type { Canvas2D } from "@/templates/Canvas2D";
import type { DrawableImage } from "@/templates/VideoTemplate";
import { useController } from "@/views/hooks/useController";

const TABS: { id: PreviewTab; label: string }[] = [
  { id: "intro", label: "Thumbnail đầu" },
  { id: "body", label: "Cảnh thân bài" },
];

const UPLOAD_TABS: { id: PreviewTab; label: string }[] = [
  { id: "intro", label: "Thumbnail đầu" },
  { id: "body", label: "Khung video" },
];

const OVERLAY_TABS: { id: PreviewTab; label: string }[] = [
  { id: "intro", label: "Đang đọc tiêu đề" },
  { id: "body", label: "Sau khi đọc" },
];

function canvas2d(width: number, height: number): { canvas: HTMLCanvasElement; ctx: Canvas2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không cấp được canvas 2D");
  return { canvas, ctx: ctx as unknown as Canvas2D };
}

/** Xem trước sống của bước 1: vẽ bằng đúng template video trên canvas 1080×1920 co theo khung 9:16. */
export function PreviewPanel({ studio, form, image }: { studio: Studio; form: PreviewForm; image?: DrawableImage | null }) {
  const [controller] = useState(
    () =>
      new PreviewController({
        session: studio.session,
        templates: studio.services.templates,
        schedule: (fn, ms) => {
          const handle = setTimeout(fn, ms);
          return () => clearTimeout(handle);
        },
        loadFonts: (faces) => loadFonts(faces, document.fonts, window.location.origin),
        decodeImage: async (blob) => {
          const bitmap = await createImageBitmap(blob);
          return { image: { source: bitmap, width: bitmap.width, height: bitmap.height }, dispose: () => bitmap.close() };
        },
        loadImageUrl: (url) => loadImageUrl(url, window.location.origin),
      }),
  );
  const state = useController(controller);
  const data = useController(studio.session);
  const overlay = form.kind === "upload" && data.options.uploadComposition === "title-over-clip";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const placeholder = canvas2d(PLACEHOLDER_SIZE.width, PLACEHOLDER_SIZE.height);
    drawPlaceholder(placeholder.ctx);
    const backdrop = new CanvasBackdropMaker((w, h) => canvas2d(w, h));
    const detach = controller.attach({
      ctx: ctx as unknown as Canvas2D,
      placeholder: { source: placeholder.canvas, ...PLACEHOLDER_SIZE },
      backdrop,
    });
    return () => {
      detach();
      // nhả bộ nhớ canvas phụ ngay (không chờ GC)
      placeholder.canvas.width = 0;
      placeholder.canvas.height = 0;
    };
  }, [controller]);

  const { text, title, sourceCredit, publishDateText, templateId, kind } = form;
  useEffect(() => {
    controller.setForm({ text, title, sourceCredit, publishDateText, templateId, kind });
  }, [controller, text, title, sourceCredit, publishDateText, templateId, kind]);
  useEffect(() => {
    controller.setImage(image ?? null);
  }, [controller, image]);
  const tabs = overlay ? OVERLAY_TABS : kind === "upload" ? UPLOAD_TABS : TABS;

  return (
    <aside aria-label="Xem trước video" className="order-1 flex flex-col gap-2 lg:order-2 lg:sticky lg:top-4 lg:self-start">
      <button
        type="button"
        aria-expanded={open}
        className="min-h-11 rounded-md bg-neutral-800 px-3 py-1.5 text-sm lg:hidden"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Ẩn xem trước" : "Xem trước"}
      </button>
      <div className={`${open ? "flex" : "hidden"} flex-col gap-2 lg:flex`}>
        <div role="tablist" aria-label="Khung xem trước" className="flex gap-1 text-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={state.tab === t.id}
              className={`min-h-11 sm:min-h-0 flex-1 rounded-md px-2 py-1 ${state.tab === t.id ? "bg-emerald-700" : "bg-neutral-800"}`}
              onClick={() => controller.setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <canvas
          ref={canvasRef}
          width={1080}
          height={1920}
          data-testid="xem-truoc-canvas"
          data-draw-count={state.drawCount}
          aria-label={
            overlay
              ? state.tab === "intro"
                ? "Xem trước lúc đọc tiêu đề"
                : "Xem trước sau khi đọc"
              : state.tab === "intro"
                ? "Xem trước thumbnail đầu"
                : kind === "upload"
                  ? "Xem trước khung video"
                  : "Xem trước cảnh thân bài"
          }
          className="mx-auto aspect-[9/16] w-full max-w-[320px] rounded-md bg-neutral-900"
        />
        {state.usingSample && <p className="text-xs text-neutral-400">Đang dùng nội dung mẫu</p>}
        <p className="text-xs text-neutral-500">
          {kind === "upload"
            ? image
              ? "Khung lấy từ video của bạn."
              : "Ảnh nền là ảnh minh hoạ; khung thật lấy từ video bạn tải lên ở bước 2."
            : "Ảnh nền là ảnh minh hoạ; cảnh trám thật chọn ở bước 3."}
        </p>
        {state.error && (
          <p className="text-xs text-red-400">
            {state.error}
          </p>
        )}
      </div>
    </aside>
  );
}
