"use client";

import { useEffect } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import type { BrandFieldSpec } from "@/domain/BrandKit";
import { useController } from "@/views/hooks/useController";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
const kb = (blob: Blob) => Math.round(blob.size / 1024);

export function BrandPanel({ studio, templateId }: { studio: Studio; templateId: string }) {
  const brand = useController(studio.brand);

  useEffect(() => {
    void studio.brand.load(templateId);
  }, [studio, templateId]);

  if (brand.templateId !== templateId) return null;

  const imageField = (spec: BrandFieldSpec) => {
    const banner = spec.key === "banner";
    return (
      <div key={spec.key} className="flex min-w-0 flex-col gap-1 text-sm">
        {spec.label}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            className="max-w-full"
            aria-label={spec.label}
            accept={IMAGE_ACCEPT}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (banner) void studio.brand.setBanner(file);
                else studio.brand.setLogo(file);
              }
              e.target.value = "";
            }}
          />
          {!banner && brand.logo && (
            <button type="button" className="min-h-11 sm:min-h-0 rounded-md bg-neutral-800 px-3 py-1" onClick={() => studio.brand.clearLogo()}>
              Bỏ logo ({kb(brand.logo)} KB)
            </button>
          )}
          {banner && brand.banner && (
            <button type="button" className="min-h-11 sm:min-h-0 rounded-md bg-neutral-800 px-3 py-1" onClick={() => studio.brand.clearBanner()}>
              Dùng banner mặc định
            </button>
          )}
        </div>
        {banner && (
          <p className="text-xs text-neutral-500">
            {brand.banner
              ? `Đang dùng banner của bạn (${kb(brand.banner)} KB).`
              : "Đang dùng banner mặc định (US Pickleball × US Recovery)."}{" "}
            Ảnh ngang PNG/JPG/WebP, tối đa 5 MB, tỉ lệ 2:1 đến 5:1 (khuyên 3:1, ví dụ 2048×682); phần thừa bị cắt cho vừa dải 1080×360.
          </p>
        )}
      </div>
    );
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-neutral-800 p-4">
      <legend className="px-2 text-sm text-neutral-400">Thương hiệu của phong cách này</legend>
      {brand.specs.map((spec) =>
        spec.type === "image" ? (
          imageField(spec)
        ) : (
          <label key={spec.key} className="flex flex-col gap-1 text-sm">
            {spec.label}
            <input
              type={spec.type === "color" ? "color" : spec.type === "number" ? "number" : "text"}
              maxLength={spec.maxLength}
              min={spec.min}
              max={spec.max}
              step={spec.type === "number" ? 1 : undefined}
              className="rounded-md bg-neutral-800 px-3 py-2"
              value={brand.values[spec.key] ?? ""}
              onChange={(e) => studio.brand.setValue(spec.key, e.target.value)}
            />
          </label>
        ),
      )}
      {brand.error && (
        <p role="alert" className="text-sm text-red-400">
          {brand.error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="min-h-11 sm:min-h-0 rounded-md bg-neutral-700 px-3 py-1.5 text-sm"
          onClick={() => void studio.brand.save()}
        >
          Lưu thương hiệu
        </button>
        {brand.saved && <span className="text-sm text-emerald-400">Đã lưu trên máy này</span>}
      </div>
    </fieldset>
  );
}
