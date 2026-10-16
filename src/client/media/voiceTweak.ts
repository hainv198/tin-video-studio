/** Tinh chỉnh giọng SAU khi đã có giọng: đổi tốc độ (giữ cao độ) và đổi tông (giữ tốc độ), chạy hoàn toàn ở máy. */
export interface VoiceTweak {
  /** Hệ số tốc độ: 1,25 = nhanh hơn 25% (độ dài ÷ 1,25). */
  tempo: number;
  /** Đổi tông theo nửa cung (12 = lên một quãng tám). */
  pitchSemitones: number;
}

export function isDefaultVoiceTweak(tweak: VoiceTweak): boolean {
  return tweak.tempo === 1 && tweak.pitchSemitones === 0;
}

/** Cửa sổ WSOLA ~30 ms (đủ dài để chứa vài chu kỳ giọng nói, đủ ngắn để không nhoè âm). */
const FRAME_SEC = 0.03;
/** Biên độ tìm vị trí khớp sóng quanh vị trí danh nghĩa (±12 ms, dài hơn chu kỳ giọng trầm ~80 Hz). */
const TOLERANCE_SEC = 0.012;

/**
 * Áp tinh chỉnh lên mẫu mono. Mặc định (tempo 1, tông 0) trả CHÍNH mảng đầu vào.
 * Độ dài kết quả = round(độ dài gốc / tempo).
 * Đổi tông r = 2^(nửa cung/12): co giãn thời gian với tempo/r (giữ cao độ) rồi lấy mẫu lại theo r.
 */
export function applyVoiceTweak(samples: Float32Array, sampleRate: number, tweak: VoiceTweak): Float32Array {
  if (isDefaultVoiceTweak(tweak)) return samples;
  const targetLength = Math.round(samples.length / tweak.tempo);
  if (samples.length === 0 || targetLength === 0) return new Float32Array(targetLength);
  const ratio = 2 ** (tweak.pitchSemitones / 12);
  const stretched = ratio === 1 ? timeStretch(samples, sampleRate, tweak.tempo) : timeStretch(samples, sampleRate, tweak.tempo / ratio);
  return ratio === 1 ? fitLength(stretched, targetLength) : resample(stretched, ratio, targetLength);
}

/**
 * WSOLA (Waveform Similarity Overlap-Add): cắt khung Hann chồng 50%, mỗi khung lấy ở vị trí danh nghĩa
 * `k·hop·tempo` lệch tối đa ±tolerance sao cho khớp sóng nhất với phần nối tự nhiên của khung trước,
 * rồi cộng chồng với bước `hop`. Giữ nguyên cao độ, đổi độ dài ≈ ÷ tempo.
 */
function timeStretch(input: Float32Array, sampleRate: number, tempo: number): Float32Array {
  const outLength = Math.max(1, Math.round(input.length / tempo));
  let frame = Math.round(sampleRate * FRAME_SEC);
  frame -= frame % 2;
  if (input.length < frame * 2 || frame < 8) return fitLength(resample(input, input.length / outLength, outLength), outLength);
  const hop = frame / 2;
  const tolerance = Math.max(1, Math.round(sampleRate * TOLERANCE_SEC));
  const window = new Float32Array(frame);
  for (let i = 0; i < frame; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / frame); // Hann tuần hoàn: chồng 50% cộng đúng bằng 1

  // Đệm 0 hai đầu để khỏi kiểm biên khi tìm và đọc khung.
  const pad = tolerance + frame;
  const src = new Float32Array(input.length + 2 * pad + frame);
  src.set(input, pad);
  const sourceEnd = input.length + pad; // không đọc quá phần có tín hiệu thật + đệm cuối

  const acc = new Float64Array(outLength + frame);
  const weight = new Float64Array(outLength + frame);
  const frames = Math.ceil(outLength / hop) + 1;
  let prev = pad; // vị trí (trong src) của khung vừa đặt
  for (let k = 0; k < frames; k++) {
    const nominal = pad + Math.round(k * hop * tempo);
    let pos = nominal;
    if (k > 0) pos = bestMatch(src, prev + hop, nominal, tolerance, frame, sourceEnd);
    const outPos = k * hop;
    for (let j = 0; j < frame && outPos + j < acc.length; j++) {
      const w = window[j]!;
      acc[outPos + j]! += src[pos + j]! * w;
      weight[outPos + j]! += w;
    }
    prev = pos;
  }
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) out[i] = acc[i]! / Math.max(weight[i]!, 1e-3);
  return out;
}

/** Vị trí trong [nominal−tol, nominal+tol] mà khung khớp nhất (tương quan chéo) với đoạn `natural`. Tìm thô rồi tinh. */
function bestMatch(src: Float32Array, natural: number, nominal: number, tolerance: number, frame: number, limit: number): number {
  const maxPos = Math.min(src.length - frame, limit);
  const lo = Math.min(maxPos, Math.max(0, nominal - tolerance));
  const hi = Math.min(maxPos, Math.max(lo, nominal + tolerance));
  const ref = Math.min(natural, src.length - frame);
  const score = (pos: number, stride: number) => {
    let s = 0;
    for (let j = 0; j < frame; j += stride) s += src[pos + j]! * src[ref + j]!;
    return s;
  };
  // Ưu tiên vị trí danh nghĩa khi mọi điểm như nhau (im lặng).
  let best = Math.min(hi, Math.max(lo, nominal));
  let bestScore = score(best, 4);
  for (let pos = lo; pos <= hi; pos += 4) {
    const s = score(pos, 4);
    if (s > bestScore) {
      bestScore = s;
      best = pos;
    }
  }
  const coarse = best;
  bestScore = score(coarse, 1);
  for (let pos = Math.max(lo, coarse - 4); pos <= Math.min(hi, coarse + 4); pos++) {
    const s = score(pos, 1);
    if (s > bestScore) {
      bestScore = s;
      best = pos;
    }
  }
  return best;
}

/** Lấy mẫu lại nội suy tuyến tính: out[i] = in[i·step]; đọc nhanh hơn (step > 1) thì cao độ tăng theo step. */
function resample(input: Float32Array, step: number, outLength: number): Float32Array {
  const out = new Float32Array(outLength);
  const last = input.length - 1;
  for (let i = 0; i < outLength; i++) {
    const x = i * step;
    const i0 = Math.floor(x);
    if (i0 >= last) {
      out[i] = i0 === last ? input[last]! : 0;
      continue;
    }
    const frac = x - i0;
    out[i] = input[i0]! * (1 - frac) + input[i0 + 1]! * frac;
  }
  return out;
}

function fitLength(samples: Float32Array, length: number): Float32Array {
  if (samples.length === length) return samples;
  const out = new Float32Array(length);
  out.set(samples.subarray(0, length));
  return out;
}

/** Đóng gói mẫu mono thành WAV PCM 16-bit (kẹp về [−1, 1]) để nghe thử bằng thẻ <audio>. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, Math.round(v * 32767), true);
  }
  return new Uint8Array(buffer);
}
