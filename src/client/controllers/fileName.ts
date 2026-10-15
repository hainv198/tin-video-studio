const pad2 = (n: number) => String(n).padStart(2, "0");

/** `slug-tieu-de_yyyymmdd.mp4`: không dấu, chữ thường, tối đa 60 ký tự cho phần slug. */
export function fileNameFor(title: string, publishDate: Date): string {
  const slug =
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "tin";
  const date = `${publishDate.getFullYear()}${pad2(publishDate.getMonth() + 1)}${pad2(publishDate.getDate())}`;
  return `${slug}_${date}.mp4`;
}
