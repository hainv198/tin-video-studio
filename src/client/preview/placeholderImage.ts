import type { Canvas2D } from "@/templates/Canvas2D";

export const PLACEHOLDER_SIZE = { width: 1600, height: 900 } as const;
export const PLACEHOLDER_LABEL = "ảnh minh hoạ";

/** Ảnh minh hoạ vẽ bằng code (gradient + vài hình đơn giản) thay cảnh trám ở xem trước bước 1. */
export function drawPlaceholder(ctx: Canvas2D): void {
  const { width, height } = PLACEHOLDER_SIZE;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#5b7c99");
  sky.addColorStop(1, "#c9b79c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,236,179,0.85)";
  ctx.beginPath();
  ctx.arc(width * 0.78, height * 0.28, 90, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#3f4d5a";
  ctx.beginPath();
  ctx.rect(160, 420, 260, 480);
  ctx.rect(470, 300, 200, 600);
  ctx.rect(720, 470, 320, 430);
  ctx.rect(1100, 380, 220, 520);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  for (let y = 460; y < 860; y += 70) {
    ctx.rect(200, y, 40, 36);
    ctx.rect(320, y, 40, 36);
    ctx.rect(760, y + 20, 40, 36);
    ctx.rect(900, y + 20, 40, 36);
  }
  ctx.fill();

  ctx.font = "600 26px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  // Giữa mép trên: template cắt ảnh theo kiểu cover nên hai bên và đáy (dải gradient) có thể bị che.
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(PLACEHOLDER_LABEL, width / 2, 16);
}
