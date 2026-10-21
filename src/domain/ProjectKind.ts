/** Kiểu video của một dự án. "news": tin chia nhiều cảnh (kiểu gốc). "upload": thẻ tiêu đề + video người dùng tải lên. */
export type ProjectKind = "news" | "upload";

export const PROJECT_KINDS: readonly ProjectKind[] = ["news", "upload"];

export const PROJECT_KIND_LABELS: Record<ProjectKind, string> = {
  news: "Bản tin nhiều cảnh",
  upload: "Video tải lên",
};

/** Dòng thứ hai của khối nguồn tin trên video (dưới "THEO: …"). */
export const MEDIA_CREDIT: Record<ProjectKind, string> = {
  news: "ẢNH: TỔNG HỢP",
  upload: "VIDEO: TỔNG HỢP",
};

export function isProjectKind(v: unknown): v is ProjectKind {
  return v === "news" || v === "upload";
}
