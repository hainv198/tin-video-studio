"use client";

import { useState } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { useController } from "@/views/hooks/useController";

const FOOTAGE_KINDS = [
  { id: "any", label: "Cả ảnh và video" },
  { id: "image", label: "Ưu tiên ảnh" },
  { id: "video", label: "Ưu tiên video" },
] as const;

const SELECT = "rounded-md bg-neutral-800 px-3 py-2 disabled:opacity-50";

export function OptionsSidebar({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const panel = useController(studio.options);
  const [open, setOpen] = useState(false);
  const options = data.options;
  const colors = studio.options.introColors();
  const fonts = studio.options.fontChoices;

  return (
    <aside aria-label="Tuỳ chọn video" className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="tvs-tuy-chon-video"
        className="rounded-md bg-neutral-800 px-4 py-2 text-left font-medium lg:hidden"
        onClick={() => setOpen(!open)}
      >
        Tuỳ chọn video {open ? "▲" : "▼"}
      </button>
      <div
        id="tvs-tuy-chon-video"
        className={`${open ? "flex" : "hidden"} flex-col gap-5 rounded-lg border border-neutral-800 p-4 text-sm lg:flex`}
      >
        <h2 className="hidden text-base font-semibold lg:block">Tuỳ chọn video</h2>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Phụ đề</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.subtitlesEnabled}
              onChange={(e) => studio.options.setSubtitlesEnabled(e.target.checked)}
            />
            Hiện phụ đề
          </label>
          <label htmlFor="tvs-font-phu-de" className="text-neutral-400">
            Font phụ đề
          </label>
          <select
            id="tvs-font-phu-de"
            className={SELECT}
            disabled={!options.subtitlesEnabled}
            value={options.subtitleFontId}
            onChange={(e) => studio.options.setSubtitleFont(e.target.value)}
          >
            {fonts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Font chữ tiêu đề và nhãn</legend>
          <label htmlFor="tvs-font-chu" className="sr-only">
            Font chữ tiêu đề và nhãn
          </label>
          <select
            id="tvs-font-chu"
            className={SELECT}
            value={options.textFontId}
            onChange={(e) => studio.options.setTextFont(e.target.value)}
          >
            {fonts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500">Tiêu đề mở đầu, tên kênh, dòng nguồn, tem ngày.</p>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Thumbnail đầu</legend>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="tvs-mau-nen">Màu nền thumbnail</label>
            <input
              id="tvs-mau-nen"
              type="color"
              className="h-8 w-12 cursor-pointer rounded bg-transparent"
              value={colors.backgroundColor}
              onChange={(e) => studio.options.setIntroBackground(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="tvs-mau-khoi">Màu khối sau tiêu đề</label>
            <input
              id="tvs-mau-khoi"
              type="color"
              className="h-8 w-12 cursor-pointer rounded bg-transparent"
              value={colors.blockColor}
              onChange={(e) => studio.options.setIntroBlock(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={!colors.custom}
            className="self-start rounded-md bg-neutral-800 px-3 py-1.5 disabled:opacity-40"
            onClick={() => studio.options.resetIntroColors()}
          >
            Về mặc định
          </button>
          <p className="text-xs text-neutral-500">Mặc định theo màu chủ đạo của thương hiệu.</p>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Ảnh/Video khi tự tìm</legend>
          {FOOTAGE_KINDS.map((k) => (
            <label key={k.id} className="flex items-center gap-2">
              <input
                type="radio"
                name="footage-kind"
                value={k.id}
                checked={options.footageKind === k.id}
                onChange={() => studio.options.setFootageKind(k.id)}
              />
              {k.label}
            </label>
          ))}
        </fieldset>

        {panel.error && (
          <p role="alert" className="text-red-400">
            {panel.error}
          </p>
        )}
      </div>
    </aside>
  );
}
