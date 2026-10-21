export const MIX_DEFAULTS = {
  voiceTargetDb: -16.5,
  gateDb: -45,
  fadeInSec: 1.5,
  fadeOutSec: 2,
  ceiling: 0.89,
  /** Nhạc nền thấp hơn tiếng gốc của video tải lên ít nhất ngần này (dB). */
  sourceOverMusicDb: 12,
  /** Vuốt vào/ra tiếng gốc chống tiếng tách ở biên thẻ đầu/cuối video. */
  sourceEdgeFadeSec: 0.02,
  /** Ducking tiếng gốc trong lúc đọc tiêu đề đè trên video: sâu (dB), vào trước giọng, ra sau giọng (giây). */
  duckDb: 12,
  duckAttackSec: 0.2,
  duckReleaseSec: 0.25,
} as const;

export interface MonoClip {
  startSec: number;
  samples: Float32Array;
}

export interface MusicBed {
  /** 1 kênh (mono) hoặc 2 kênh (trái, phải), cùng sampleRate với bản trộn. */
  channels: Float32Array[];
  levelBelowVoiceDb: number;
}

/** Tiếng gốc của video tải lên: đặt từ `startSec`, nhân `gain`, KHÔNG chuẩn hoá. */
export interface SourceBed {
  /** 1 kênh (mono) hoặc 2 kênh (trái, phải), cùng sampleRate với bản trộn. */
  channels: Float32Array[];
  startSec: number;
  /** 0 = tắt; 1 = giữ nguyên; tối đa 1,5. */
  gain: number;
  /** Hạ tiếng gốc trong cửa sổ này (giọng đọc tiêu đề đè trên video); bỏ trống = không hạ. */
  duck?: DuckWindow;
}

/** Cửa sổ hạ tiếng gốc, mốc theo giây trên toàn chương trình (không phải theo tiếng gốc). */
export interface DuckWindow {
  startSec: number;
  endSec: number;
  depthDb?: number;
  attackSec?: number;
  releaseSec?: number;
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

const raisedCosine = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));

/**
 * Hệ số biên độ tuyến tính của tiếng gốc ở giây `tSec`: 1 ngoài cửa sổ, 10^(−depth/20) trong lúc đọc; vào trong
 * `attackSec` trước `startSec` và ra trong `releaseSec` sau `endSec` theo cosin nâng (nội suy trên biên độ).
 */
export function duckGain(tSec: number, duck: DuckWindow): number {
  const attack = duck.attackSec ?? MIX_DEFAULTS.duckAttackSec;
  const release = duck.releaseSec ?? MIX_DEFAULTS.duckReleaseSec;
  if (tSec <= duck.startSec - attack || tSec >= duck.endSec + release) return 1;
  const floor = dbToGain(-(duck.depthDb ?? MIX_DEFAULTS.duckDb));
  let amount = 1;
  if (tSec < duck.startSec) amount = attack > 0 ? raisedCosine((tSec - (duck.startSec - attack)) / attack) : 1;
  else if (tSec > duck.endSec) amount = release > 0 ? 1 - raisedCosine((tSec - duck.endSec) / release) : 0;
  return 1 - (1 - floor) * amount;
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
  const first = ahead[0] as number;

  // Trung bình trượt 5 ms bằng tổng chạy (số thực 64 bit) thay cho mảng tiền tố.
  let running = 0;
  let minGain = 1;
  for (let i = 0; i < n; i++) {
    running += ahead[i] as number;
    if (i >= w) running -= ahead[i - w] as number;
    const padded = i < w - 1 ? (w - 1 - i) * first : 0;
    const gain = (running + padded) / w;
    left[i] = (left[i] ?? 0) * gain;
    right[i] = (right[i] ?? 0) * gain;
    if (gain < minGain) minGain = gain;
  }
  return 20 * Math.log10(minGain);
}

export function mixProgram(
  voices: readonly MonoClip[],
  music: MusicBed | null,
  options: MixOptions,
  source: SourceBed | null = null,
): StereoMix {
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

  // Tiếng gốc: mức của nó (sau hệ số) quyết định trần của nhạc nền.
  let sourceLevelDb = -Infinity;
  if (source && source.gain > 0 && source.channels.length > 0) {
    const srcL = source.channels[0] as Float32Array;
    const srcR = source.channels[1] ?? srcL;
    const start = Math.round(source.startSec * sr);
    const len = Math.min(srcL.length, n - start);
    const edge = Math.max(1, Math.round(MIX_DEFAULTS.sourceEdgeFadeSec * sr));
    const duck = source.duck;
    for (let j = 0; j < len; j++) {
      // Không duck thì d = 1: nhân 1 là phép tính chính xác, mẫu trùng tuyệt đối với trước.
      const d = duck ? duckGain((start + j) / sr, duck) : 1;
      const g = source.gain * Math.min(1, j / edge, (len - 1 - j) / edge) * d;
      left[start + j] = (left[start + j] ?? 0) + (srcL[j] ?? 0) * g;
      right[start + j] = (right[start + j] ?? 0) + (srcR[j] ?? 0) * g;
    }
    const level = rmsDb(srcL);
    if (Number.isFinite(level)) sourceLevelDb = level + 20 * Math.log10(source.gain);
  }

  if (music && music.channels.length > 0) {
    const srcL = music.channels[0] as Float32Array;
    const srcR = music.channels[1] ?? srcL;
    const musicLevel = rmsDb(srcL, -60);
    if (Number.isFinite(musicLevel) && srcL.length > 0) {
      const musicTargetDb = Number.isFinite(sourceLevelDb)
        ? Math.min(target - music.levelBelowVoiceDb, sourceLevelDb - MIX_DEFAULTS.sourceOverMusicDb)
        : target - music.levelBelowVoiceDb;
      const gain = dbToGain(musicTargetDb - musicLevel);
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
