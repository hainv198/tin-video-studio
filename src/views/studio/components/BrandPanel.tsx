"use client";

import { useEffect } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { useController } from "@/views/hooks/useController";

export function BrandPanel({ studio, templateId }: { studio: Studio; templateId: string }) {
  const brand = useController(studio.brand);

  useEffect(() => {
    void studio.brand.load(templateId);
  }, [studio, templateId]);

  if (brand.templateId !== templateId) return null;
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-neutral-800 p-4">
      <legend className="px-2 text-sm text-neutral-400">Thương hiệu của phong cách này</legend>
      {brand.specs.map((spec) =>
        spec.type === "image" ? (
          <div key={spec.key} className="flex flex-col gap-1 text-sm">
            {spec.label}
            <div className="flex items-center gap-3">
              <input
                type="file"
                aria-label={spec.label}
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) studio.brand.setLogo(file);
                  e.target.value = "";
                }}
              />
              {brand.logo && (
                <button type="button" className="rounded-md bg-neutral-800 px-3 py-1" onClick={() => studio.brand.clearLogo()}>
                  Bỏ logo ({Math.round(brand.logo.size / 1024)} KB)
                </button>
              )}
            </div>
          </div>
        ) : (
          <label key={spec.key} className="flex flex-col gap-1 text-sm">
            {spec.label}
            <input
              type={spec.type === "color" ? "color" : "text"}
              maxLength={spec.maxLength}
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
          className="rounded-md bg-neutral-700 px-3 py-1.5 text-sm"
          onClick={() => void studio.brand.save()}
        >
          Lưu thương hiệu
        </button>
        {brand.saved && <span className="text-sm text-emerald-400">Đã lưu trên máy này</span>}
      </div>
    </fieldset>
  );
}
