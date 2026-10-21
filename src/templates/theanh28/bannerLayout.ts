import { LAYOUT, type Rect, type TheAnh28Layout } from "./layout";

/** Dải banner chân video: đáy khung 1080×1920, cao 360 (ảnh 3:1). */
export const FOOTER_BANNER_BOX: Rect = { x: 0, y: 1560, w: 1080, h: 360 };

/**
 * Bố cục Theanh28 khi có banner chân: mọi nội dung đẩy lên trên y = 1560 (xem bảng D2 trong kế hoạch 07).
 * Chỉ đổi các toạ độ dọc và cỡ phụ đề; bề ngang, font, hiệu ứng giữ như LAYOUT.
 */
export const BANNER_LAYOUT: TheAnh28Layout = {
  ...LAYOUT,
  intro: {
    ...LAYOUT.intro,
    image: { x: 0, y: 0, w: 1080, h: 900 },
    gradientTop: 760,
    gradientSolid: 960,
    chip: { ...LAYOUT.intro.chip, y: 910 },
    dateTag: { x: 96, y: 1040 },
    title: { ...LAYOUT.intro.title, y: 1100 },
    pattern: { ...LAYOUT.intro.pattern, y: 1340, h: 220 },
  },
  body: { ...LAYOUT.body, band: { x: 0, y: 300, w: 1080, h: 880 }, dateTag: { x: 96, y: 1116 } },
  credit: { ...LAYOUT.credit, y: 200 },
  logo: { ...LAYOUT.logo, y: 210 },
  subtitle: { ...LAYOUT.subtitle, fontPx: 52, lineHeight: 64, bodyBottom: 1520, introBottom: 890 },
};
