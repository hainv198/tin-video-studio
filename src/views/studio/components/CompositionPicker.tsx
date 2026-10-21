"use client";

import type { Studio } from "@/client/controllers/createStudio";
import { UPLOAD_COMPOSITION_HINTS, UPLOAD_COMPOSITION_LABELS, UPLOAD_COMPOSITIONS } from "@/domain/UploadComposition";
import { useController } from "@/views/hooks/useController";

/** Ô chọn "Cách ghép" của kiểu Video tải lên (bước 1 và bước Video của bạn). */
export function CompositionPicker({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const current = data.options.uploadComposition;
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 rounded-lg border border-neutral-800 p-3 text-sm">
      <legend className="px-1 font-medium">Cách ghép</legend>
      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-6">
        {UPLOAD_COMPOSITIONS.map((c) => (
          <label key={c} className="flex min-h-11 items-center gap-2 sm:min-h-0">
            <input type="radio" name="cach-ghep" value={c} checked={current === c} onChange={() => studio.options.setUploadComposition(c)} />
            {UPLOAD_COMPOSITION_LABELS[c]}
          </label>
        ))}
      </div>
      <p className="text-xs text-neutral-500">{UPLOAD_COMPOSITION_HINTS[current]}</p>
    </fieldset>
  );
}
