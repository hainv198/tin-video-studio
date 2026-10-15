export const MIX_DEFAULTS = { voiceTargetDb: -16.5, gateDb: -45, fadeInSec: 1.5, fadeOutSec: 2, ceiling: 0.89 } as const;

export interface MonoClip {
  startSec: number;
  samples: Float32Array;
}

export interface MusicBed {
  /** 1 kênh (mono) hoặc 2 kênh (trái, phải), cùng sampleRate với bản trộn. */
  channels: Float32Array[];
  levelBelowVoiceDb: number;
}

export interface MixOptions {
  sampleRate: number;
  durationSec: number;
  voiceTargetDb?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  ceiling?: number;
}

export interface StereoMix {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  /** Độ lợi giảm lớn nhất của bộ giới hạn đỉnh (dB, ≤ 0). */
  limiterGainDb: number;
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

/** RMS (dB) của các mẫu có biên độ vượt cổng; -Infinity nếu không có mẫu nào. */
export function rmsDb(samples: Float32Array, gateDb: number = MIX_DEFAULTS.gateDb): number {
  const gate = dbToGain(gateDb);
  let sum = 0;
  let count = 0;
  for (const s of samples) {
    if (Math.abs(s) >= gate) {
      sum += s * s;
      count++;
    }
  }
  return count === 0 ? -Infinity : 10 * Math.log10(sum / count);
}

function fadeGain(i: number, n: number, sampleRate: number, fadeInSec: number, fadeOutSec: number): number {
  const fin = Math.round(fadeInSec * sampleRate);
  const fout = Math.round(fadeOutSec * sampleRate);
  let g = 1;
  if (fin > 0 && i < fin) g = Math.min(g, i / fin);
  if (fout > 0 && i >= n - fout) g = Math.min(g, (n - 1 - i) / fout);
  return Math.max(0, g);
}

export const LIMITER_LOOKAHEAD_SEC = 0.005;

/** Giá trị nhỏ nhất của `gain[j .. j+w-1]` cho mọi j (cửa sổ nhìn về phía trước), O(n). */
function slidingMinAhead(gain: Float32Array, w: number): Float32Array {
  const n = gain.length;
  const out = new Float32Array(n);
  const deque: number[] = [];
  let head = 0;
  for (let j = n - 1; j >= 0; j--) {
    while (deque.length > head && (gain[deque[deque.length - 1] as number] as number) >= (gain[j] as number)) deque.pop();
    deque.push(j);
    while ((deque[head] as number) > j + w - 1) head++;
    out[j] = gain[deque[head] as number] as number;
  }
  return out;
}

/**
 * Bộ giới hạn đỉnh có nhìn trước: độ lợi cần thiết tại mỗi đỉnh được lấy min trong 5 ms phía trước rồi làm mượt
 * bằng trung bình 5 ms, nên độ lợi giảm dần vào đỉnh và hồi lại ngay sau đó, phần còn lại của bài không bị hạ.
 * Sửa tại chỗ; trả độ lợi giảm lớn nhất (dB, ≤ 0).
 */
export function applyLimiter(left: Float32Array, right: Float32Array, sampleRate: number, ceiling: number): number {
  const n = left.length;
  const need = new Float32Array(n);
  let anyOver = false;
  for (let i = 0; i < n; i++) {
    const peak = Math.max(Math.abs(left[i] ?? 0), Math.abs(right[i] ?? 0));
    if (peak > ceiling) {
      need[i] = ceiling / peak;
      anyOver = true;
    } else {
      need[i] = 1;
    }
  }
  if (!anyOver) return 0;

  const w = Math.max(1, Math.round(LIMITER_LOOKAHEAD_SEC * sampleRate));
  const ahead = slidingMinAhead(need, w);
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = (prefix[i] as number) + (ahead[i] as number);
  const first = ahead[0] as number;

  let minGain = 1;
  for (let i = 0; i < n; i++) {
    const from = i - w + 1;
    const inside = (prefix[i + 1] as number) - (prefix[Math.max(0, from)] as number);
    const padded = from < 0 ? -from * first : 0;
    const gain = (inside + padded) / w;
    left[i] = (left[i] ?? 0) * gain;
    right[i] = (right[i] ?? 0) * gain;
    if (gain < minGain) minGain = gain;
  }
  return 20 * Math.log10(minGain);
}

export function mixProgram(voices: readonly MonoClip[], music: MusicBed | null, options: MixOptions): StereoMix {
  const sr = options.sampleRate;
  const n = Math.ceil(options.durationSec * sr);
  const target = options.voiceTargetDb ?? MIX_DEFAULTS.voiceTargetDb;
  const fadeIn = options.fadeInSec ?? MIX_DEFAULTS.fadeInSec;
  const fadeOut = options.fadeOutSec ?? MIX_DEFAULTS.fadeOutSec;
  const ceiling = options.ceiling ?? MIX_DEFAULTS.ceiling;

  const voice = new Float32Array(n);
  for (const clip of voices) {
    const start = Math.round(clip.startSec * sr);
    for (let j = 0; j < clip.samples.length && start + j < n; j++) {
      voice[start + j] = (voice[start + j] ?? 0) + (clip.samples[j] ?? 0);
    }
  }
  const voiceLevel = rmsDb(voice);
  const voiceGain = Number.isFinite(voiceLevel) ? dbToGain(target - voiceLevel) : 1;

  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = (voice[i] ?? 0) * voiceGain;
    left[i] = v;
    right[i] = v;
  }

  if (music && music.channels.length > 0) {
    const srcL = music.channels[0] as Float32Array;
    const srcR = music.channels[1] ?? srcL;
    const musicLevel = rmsDb(srcL, -60);
    if (Number.isFinite(musicLevel) && srcL.length > 0) {
      const gain = dbToGain(target - music.levelBelowVoiceDb - musicLevel);
      for (let i = 0; i < n; i++) {
        const f = gain * fadeGain(i, n, sr, fadeIn, fadeOut);
        left[i] = (left[i] ?? 0) + (srcL[i % srcL.length] ?? 0) * f;
        right[i] = (right[i] ?? 0) + (srcR[i % srcR.length] ?? 0) * f;
      }
    }
  }

  const limiterGainDb = applyLimiter(left, right, sr, ceiling);
  return { left, right, sampleRate: sr, limiterGainDb };
}
