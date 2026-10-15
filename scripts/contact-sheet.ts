import { execFileSync } from "node:child_process";

function usage(): never {
  console.error("Cách dùng: npm run contact:sheet -- <mau.mp4> <dung.mp4> <out.png> [t1,t2,...]");
  process.exit(1);
}

const [sample, rendered, out, timesArg] = process.argv.slice(2);
if (!sample || !rendered || !out) usage();
const times = (timesArg ?? "1,8,20").split(",").map(Number).filter((t) => Number.isFinite(t) && t >= 0);
if (times.length === 0) usage();

// Mỗi mốc: lấy 1 khung từ mỗi video (-ss trước -i để tua nhanh), thu về 540x960, ghép ngang; rồi ghép dọc các mốc.
const inputs: string[] = [];
const labels: string[] = [];
times.forEach((t, i) => {
  inputs.push("-ss", String(t), "-i", sample, "-ss", String(t), "-i", rendered);
  labels.push(`[${2 * i}:v]scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2,trim=end_frame=1[a${i}];`);
  labels.push(`[${2 * i + 1}:v]scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2,trim=end_frame=1[b${i}];`);
  labels.push(`[a${i}][b${i}]hstack=inputs=2[row${i}];`);
});
const rows = times.map((_, i) => `[row${i}]`).join("");
const filter = labels.join("") + (times.length > 1 ? `${rows}vstack=inputs=${times.length}[out]` : `[row0]copy[out]`);
try {
  execFileSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", filter, "-map", "[out]", "-frames:v", "1", out], {
    stdio: "inherit",
  });
} catch (error) {
  if ((error as { code?: string }).code === "ENOENT") {
    console.error("Cần ffmpeg trong PATH");
    process.exit(2);
  }
  throw error;
}
console.log(`Đã ghi ${out}: ${times.length} hàng × 2 cột (mẫu | dựng), mỗi ô 540×960`);
