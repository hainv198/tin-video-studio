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

  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(left[i] ?? 0), Math.abs(right[i] ?? 0));
  if (peak > ceiling) {
    const k = ceiling / peak;
    for (let i = 0; i < n; i++) {
      left[i] = (left[i] ?? 0) * k;
      right[i] = (right[i] ?? 0) * k;
    }
  }
  return { left, right, sampleRate: sr };
}
