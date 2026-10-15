export interface AudioMetricsOptions {
  windowSec?: number;
  gateDb?: number;
  voicedBelowP90Db?: number;
}

export interface AudioMetrics {
  durationSec: number;
  peak: number;
  windows: number;
  voicedWindows: number;
  /** RMS (trung bình năng lượng) của các cửa sổ có tiếng, dB. NaN nếu không có. */
  voicedRmsDb: number;
  /** RMS của các cửa sổ trên cổng nhưng không có tiếng (nhạc nền lúc nghỉ), dB. NaN nếu không có. */
  quietRmsDb: number;
  p90Db: number;
}

const meanDb = (dbs: number[]): number =>
  dbs.length === 0 ? Number.NaN : 10 * Math.log10(dbs.reduce((e, d) => e + 10 ** (d / 10), 0) / dbs.length);

/** Cùng phương pháp đo của chặng 3A/3C: cửa sổ 100 ms trộn mono, cổng −45 dB, có tiếng = trên p90 − 12 dB. */
export function audioMetrics(channels: Float32Array[], sampleRate: number, options: AudioMetricsOptions = {}): AudioMetrics {
  const windowSec = options.windowSec ?? 0.1;
  const gateDb = options.gateDb ?? -45;
  const below = options.voicedBelowP90Db ?? 12;
  const first = channels[0] ?? new Float32Array();
  const n = first.length;
  const w = Math.max(1, Math.round(windowSec * sampleRate));
  let peak = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i] ?? 0));
  const windowDb: number[] = [];
  for (let start = 0; start + w <= n; start += w) {
    let energy = 0;
    for (let i = start; i < start + w; i++) {
      let x = 0;
      for (const ch of channels) x += ch[i] ?? 0;
      x /= channels.length;
      energy += x * x;
    }
    windowDb.push(10 * Math.log10(energy / w + 1e-12));
  }
  const sorted = [...windowDb].sort((a, b) => a - b);
  const p90Db = sorted.length ? (sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] as number) : Number.NaN;
  const voiced = windowDb.filter((d) => d > gateDb && d > p90Db - below);
  const quiet = windowDb.filter((d) => d > gateDb && d <= p90Db - below);
  return {
    durationSec: n / sampleRate,
    peak,
    windows: windowDb.length,
    voicedWindows: voiced.length,
    voicedRmsDb: meanDb(voiced),
    quietRmsDb: meanDb(quiet),
    p90Db,
  };
}
