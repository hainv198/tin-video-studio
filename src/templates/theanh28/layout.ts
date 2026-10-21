export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Toạ độ một bố cục Theanh28 (khung 1080×1920). `LAYOUT` là bố cục gốc; phong cách con truyền bố cục riêng. */
export interface TheAnh28Layout {
  frame: { width: number; height: number };
  intro: {
    image: Rect;
    gradientTop: number;
    gradientSolid: number;
    chip: { x: number; y: number; h: number; padX: number; logoSize: number; gap: number; fontPx: number };
    dateTag: { x: number; y: number };
    title: { x: number; y: number; maxWidth: number; fontPx: number; lineHeight: number; maxLines: number };
    pattern: Rect & { spacing: number; radius: number; alpha: number };
  };
  body: { band: Rect; dateTag: { x: number; y: number }; backdropScale: number; backdropShade: number };
  credit: { x: number; y: number; lineHeight: number; fontPx: number; rightMargin: number; gapToLogo: number };
  logo: { right: number; y: number; size: number; gap: number; fontPx: number };
  dateTag: { h: number; padX: number; fontPx: number };
  subtitle: {
    centerX: number;
    maxWidth: number;
    fontPx: number;
    lineHeight: number;
    maxLines: number;
    bodyBottom: number;
    introBottom: number;
    strokePx: number;
    shadowBlurPx: number;
    shadowOffsetPx: number;
  };
  kenBurns: { from: number; to: number };
  blurPx: number;
}

/** Toạ độ đo từ video mẫu Theanh28 (khung 540×960, nhân đôi lên 1080×1920). */
export const LAYOUT = {
  frame: { width: 1080, height: 1920 },
  intro: {
    image: { x: 0, y: 0, w: 1080, h: 1000 },
    gradientTop: 860,
    gradientSolid: 1060,
    chip: { x: 40, y: 1010, h: 96, padX: 24, logoSize: 64, gap: 16, fontPx: 40 },
    dateTag: { x: 96, y: 1150 },
    title: { x: 96, y: 1215, maxWidth: 888, fontPx: 64, lineHeight: 78, maxLines: 3 },
    pattern: { x: 0, y: 1450, w: 1080, h: 470, spacing: 28, radius: 3, alpha: 0.12 },
  },
  body: {
    band: { x: 0, y: 380, w: 1080, h: 920 },
    dateTag: { x: 96, y: 1236 },
    backdropScale: 1.1,
    backdropShade: 0.18,
  },
  credit: { x: 110, y: 240, lineHeight: 40, fontPx: 26, rightMargin: 40, gapToLogo: 24 },
  logo: { right: 96, y: 250, size: 64, gap: 14, fontPx: 46 },
  dateTag: { h: 44, padX: 16, fontPx: 26 },
  /** Phụ đề: căn giữa, rộng tối đa 820 (tránh cột nút TikTok bên phải), đáy ở vùng an toàn dưới (≤ 1600). Mở đầu: ngay trên chip. */
  subtitle: {
    centerX: 540,
    maxWidth: 820,
    fontPx: 54,
    lineHeight: 68,
    maxLines: 2,
    bodyBottom: 1600,
    introBottom: 990,
    strokePx: 10,
    shadowBlurPx: 6,
    shadowOffsetPx: 3,
  },
  kenBurns: { from: 1, to: 1.08 },
  blurPx: 48,
} as const satisfies TheAnh28Layout;

export function coverRect(srcW: number, srcH: number, box: Rect): Rect {
  const scale = Math.max(box.w / srcW, box.h / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/** Vừa trọn trong khung (không cắt), giữ tỉ lệ, căn giữa. */
export function containRect(srcW: number, srcH: number, box: Rect): Rect {
  const scale = Math.min(box.w / srcW, box.h / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

export function kenBurnsRect(
  base: Rect,
  progress: number,
  from: number = LAYOUT.kenBurns.from,
  to: number = LAYOUT.kenBurns.to,
): Rect {
  const p = Math.min(1, Math.max(0, progress));
  const s = from + (to - from) * p;
  if (s === 1) return { ...base };
  const w = base.w * s;
  const h = base.h * s;
  return { x: base.x - (w - base.w) / 2, y: base.y - (h - base.h) / 2, w, h };
}

export function wrapText(text: string, maxWidth: number, measure: (s: string) => number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measure(candidate) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines - 1);
  let last = lines.slice(maxLines - 1).join(" ").split(" ");
  while (last.length > 1 && measure(`${last.join(" ")}…`) > maxWidth) last = last.slice(0, -1);
  return [...kept, `${last.join(" ")}…`];
}

export function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
