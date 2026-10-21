import { formatClock } from "@/client/media/UploadValidator";
import type { StudioData } from "./StudioSession";

/** Video tải lên dài hơn ngần này (giây) thì bước Dựng nhắc giữ tab mở. */
export const LONG_CLIP_SEC = 60;

/** Câu tóm tắt ở bước Dựng. Kiểu tin giữ nguyên câu cũ. */
export function renderSummary(data: StudioData): string {
  const { project } = data;
  if (!project) return "";
  const music = data.music ? data.music.title : "không dùng";
  if (project.kind === "upload") {
    const clip = data.sourceClip;
    if (!clip) return `Chưa có video tải lên, nhạc: ${music}.`;
    const voiceSec = data.narrations.get(project.introScene.id)?.durationSec ?? 0;
    const audio = !clip.hasAudio ? "không có tiếng gốc" : clip.volumePercent === 0 ? "tắt tiếng gốc" : `tiếng gốc ${clip.volumePercent}%`;
    return `Thẻ tiêu đề (giọng khoảng ${voiceSec.toFixed(1)} giây) + video ${formatClock(clip.durationSec)} (${audio}), không phụ đề, nhạc: ${music}.`;
  }
  const voiceSeconds = [...data.narrations.values()].reduce((sum, n) => sum + n.durationSec, 0);
  return `${project.scenes.length} cảnh, giọng gốc khoảng ${voiceSeconds.toFixed(0)} giây, nhạc: ${music}.`;
}
