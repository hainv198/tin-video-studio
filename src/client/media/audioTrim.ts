import { dbToGain } from "./AudioMix";

export interface TrimOptions {
  thresholdDb?: number;
  padSec?: number;
}

export interface TrimResult {
  samples: Float32Array;
  leadTrimSec: number;
  tailTrimSec: number;
}

const DEFAULT_THRESHOLD_DB = -45;
const DEFAULT_PAD_SEC = 0.04;

/** Cắt khoảng lặng đầu/cuối (mẫu dưới ngưỡng), chừa `padSec` mỗi đầu. Trả bản sao gọn để gửi worker không kéo theo bộ đệm gốc. */
export function trimSilence(samples: Float32Array, sampleRate: number, options: TrimOptions = {}): TrimResult {
  const gate = dbToGain(options.thresholdDb ?? DEFAULT_THRESHOLD_DB);
  const pad = Math.round((options.padSec ?? DEFAULT_PAD_SEC) * sampleRate);

  let first = -1;
  let last = -1;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i] ?? 0) >= gate) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return { samples, leadTrimSec: 0, tailTrimSec: 0 };

  const from = Math.max(0, first - pad);
  const to = Math.min(samples.length, last + 1 + pad);
  if (from === 0 && to === samples.length) return { samples: samples.slice(), leadTrimSec: 0, tailTrimSec: 0 };
  return {
    samples: samples.slice(from, to),
    leadTrimSec: from / sampleRate,
    tailTrimSec: (samples.length - to) / sampleRate,
  };
}
