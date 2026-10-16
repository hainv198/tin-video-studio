import { wrapText } from "./layout";

export interface SubtitleCue {
  lines: string[];
  /** Giây tính từ đầu cảnh. */
  start: number;
  end: number;
}

/** Chia câu thành các đoạn ≤ `maxLines` dòng, mỗi dòng không quá `maxWidth` (đo bằng chữ thật). */
export function splitSubtitle(text: string, maxWidth: number, measure: (s: string) => number, maxLines = 2): string[][] {
  const lines = wrapText(text, maxWidth, measure, Number.POSITIVE_INFINITY);
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLines) chunks.push(lines.slice(i, i + maxLines));
  return chunks;
}

/** Mốc từng đoạn theo tỉ lệ số ký tự trên thời lượng giọng đọc (không có mốc từng từ). */
export function timeCues(chunks: readonly string[][], voiceStart: number, voiceDuration: number): SubtitleCue[] {
  const weights = chunks.map((lines) => Math.max(1, lines.join(" ").length));
  const total = weights.reduce((a, b) => a + b, 0);
  let before = 0;
  return chunks.map((lines, i) => {
    const start = voiceStart + (voiceDuration * before) / total;
    before += weights[i] as number;
    return { lines: [...lines], start, end: voiceStart + (voiceDuration * before) / total };
  });
}

/** Đoạn hiện ở giây `t` của cảnh: trước giọng đọc hiện đoạn đầu, sau giọng đọc giữ đoạn cuối. */
export function cueAt(cues: readonly SubtitleCue[], t: number): SubtitleCue | null {
  let current: SubtitleCue | null = cues[0] ?? null;
  for (const cue of cues) {
    if (t < cue.start) break;
    current = cue;
  }
  return current;
}
