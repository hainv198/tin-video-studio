import { execFileSync } from "node:child_process";
import { FfmpegMissingError } from "../measure-mp4";

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Tham số ffmpeg: lấy 1 khung ở giây `t`, cắt vùng `r` (toạ độ khung 1080×1920), xuất RGB24 thô. */
export function regionArgs(file: string, t: number, r: Region): string[] {
  return [
    "-v", "error", "-ss", String(t), "-i", file, "-frames:v", "1",
    "-vf", `crop=${r.w}:${r.h}:${r.x}:${r.y}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
  ];
}

/** Điểm ảnh RGB24 của vùng `r` ở giây `t`. Ném FfmpegMissingError nếu máy không có ffmpeg. */
export function grabRegion(file: string, t: number, r: Region): Uint8Array {
  let out: Buffer;
  try {
    out = execFileSync("ffmpeg", regionArgs(file, t, r), { maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") throw new FfmpegMissingError();
    throw error;
  }
  const expected = r.w * r.h * 3;
  if (out.byteLength !== expected) throw new Error(`ffmpeg trả ${out.byteLength} byte, cần ${expected}`);
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}

/** Trung bình chênh lệch tuyệt đối từng byte (0–255) giữa hai vùng cùng kích thước. */
export function meanAbsDiff(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length || a.length === 0) throw new Error("Hai vùng ảnh phải cùng kích thước");
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs((a[i] as number) - (b[i] as number));
  return sum / a.length;
}

/**
 * Độ sắc của mép trong vùng RGB24 `r`: mỗi hàng lấy chênh lệch lớn nhất giữa hai điểm ảnh kề ngang (mọi kênh màu),
 * rồi trung bình các hàng. Mép hình sắc ≈ 170–250; nền mờ (blur 48 px) ≈ 30–45; chữ trắng viền đen > 150.
 */
export function edgeSharpness(pixels: Uint8Array, r: Region): number {
  let sum = 0;
  for (let y = 0; y < r.h; y++) {
    let max = 0;
    for (let x = 0; x + 1 < r.w; x++) {
      const i = (y * r.w + x) * 3;
      for (let c = 0; c < 3; c++) max = Math.max(max, Math.abs((pixels[i + c] as number) - (pixels[i + 3 + c] as number)));
    }
    sum += max;
  }
  return sum / r.h;
}
