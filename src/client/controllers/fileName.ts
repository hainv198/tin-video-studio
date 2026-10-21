const pad2 = (n: number) => String(n).padStart(2, "0");

/** Không dấu, chữ thường, nối bằng gạch, bỏ gạch thừa hai đầu. */
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dateStamp(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

/** `slug-tieu-de_yyyymmdd.mp4`: không dấu, chữ thường, tối đa 60 ký tự cho phần slug. */
export function fileNameFor(title: string, publishDate: Date): string {
  const slug = slugify(title).slice(0, 60).replace(/-+$/g, "") || "tin";
  return `${slug}_${dateStamp(publishDate)}.mp4`;
}

/** File giọng đọc: 6 từ đầu của văn bản (không dấu, kebab-case) + ngày, ví dụ `tin-nhanh-hom-nay_20261021.wav`. */
export function audioFileName(text: string, date: Date, extension: "wav" | "m4a"): string {
  const words = text.trim().split(/\s+/).slice(0, 6).join(" ");
  const slug = slugify(words).slice(0, 60).replace(/-+$/g, "") || "giong-doc";
  return `${slug}_${dateStamp(date)}.${extension}`;
}
