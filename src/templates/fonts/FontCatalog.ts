import { FONT_CHOICES, type FontId } from "@/domain/fontIds";
import type { VideoOptionsSnapshot } from "@/domain/VideoOptions";
import type { FontFaceSpec, FontStyle, FrameStyle } from "../VideoTemplate";

export interface FontEntry {
  id: FontId;
  label: string;
  style: FontStyle;
  faces: readonly FontFaceSpec[];
}

function entry(id: FontId, family: string, semiBold: number, bold: number, faces: ReadonlyArray<[url: string, weight: string]>): FontEntry {
  const label = FONT_CHOICES.find((f) => f.id === id)?.label ?? id;
  return { id, label, style: { family, semiBold, bold }, faces: faces.map(([url, weight]) => ({ family, url, weight })) };
}

/** Font đóng gói trong public/ (giấy phép OFL, xem OFL.txt cạnh từng tệp). Font biến thiên khai một FontFace với dải weight. */
export const FONT_CATALOG: Readonly<Record<FontId, FontEntry>> = {
  phudu: entry("phudu", "TVS Phudu", 600, 800, [["/fonts/phudu/Phudu-Variable.ttf", "300 900"]]),
  "be-vietnam-pro": entry("be-vietnam-pro", "TVS Be Vietnam Pro", 600, 800, [
    ["/fonts/be-vietnam-pro/BeVietnamPro-SemiBold.ttf", "600"],
    ["/fonts/be-vietnam-pro/BeVietnamPro-ExtraBold.ttf", "800"],
  ]),
  oswald: entry("oswald", "TVS Oswald", 600, 700, [["/fonts/oswald/Oswald-Variable.ttf", "200 700"]]),
  montserrat: entry("montserrat", "TVS Montserrat", 600, 800, [["/fonts/montserrat/Montserrat-Variable.ttf", "100 900"]]),
  "roboto-condensed": entry("roboto-condensed", "TVS Roboto Condensed", 600, 800, [
    ["/fonts/roboto-condensed/RobotoCondensed-Variable.ttf", "100 900"],
  ]),
  "barlow-condensed": entry("barlow-condensed", "TVS Barlow Condensed", 600, 800, [
    ["/templates/theanh28/fonts/BarlowCondensed-SemiBold.ttf", "600"],
    ["/templates/theanh28/fonts/BarlowCondensed-ExtraBold.ttf", "800"],
  ]),
};

export function frameStyleFor(options: VideoOptionsSnapshot): FrameStyle {
  return {
    textFont: FONT_CATALOG[options.textFontId].style,
    subtitles: { enabled: options.subtitles.enabled, font: FONT_CATALOG[options.subtitles.fontId].style },
    intro: { backgroundColor: options.intro.backgroundColor ?? null, blockColor: options.intro.blockColor ?? null },
  };
}

/** Chỉ các font cần cho video này: font chữ + font phụ đề (khi bật), bỏ trùng theo URL. */
export function fontFacesFor(options: VideoOptionsSnapshot): FontFaceSpec[] {
  const ids: FontId[] = options.subtitles.enabled ? [options.textFontId, options.subtitles.fontId] : [options.textFontId];
  const seen = new Set<string>();
  const faces: FontFaceSpec[] = [];
  for (const id of ids) {
    for (const face of FONT_CATALOG[id].faces) {
      if (seen.has(face.url)) continue;
      seen.add(face.url);
      faces.push(face);
    }
  }
  return faces;
}
