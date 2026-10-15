export interface ParsedWav {
  sampleRate: number;
  channels: Float32Array[];
}

const ascii = (view: DataView, offset: number, length: number) =>
  Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join("");

/** Đọc WAV (RIFF) PCM 16-bit hoặc IEEE float 32-bit, 1–2 kênh. */
export function parseWav(bytes: Uint8Array): ParsedWav {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || ascii(view, 0, 4) !== "RIFF" || ascii(view, 8, 4) !== "WAVE") {
    throw new Error("WAV không hợp lệ: thiếu đầu RIFF/WAVE");
  }
  let offset = 12;
  let format: { code: number; channels: number; sampleRate: number; bits: number } | null = null;
  while (offset + 8 <= bytes.byteLength) {
    const id = ascii(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      format = {
        code: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      if (!format) throw new Error("WAV không hợp lệ: data đứng trước fmt");
      const { code, channels, sampleRate, bits } = format;
      const isFloat = code === 3 && bits === 32;
      const isPcm16 = code === 1 && bits === 16;
      if (!isFloat && !isPcm16) throw new Error(`WAV không hợp lệ: chỉ hỗ trợ PCM16 hoặc float32 (code ${code}, ${bits} bit)`);
      if (channels < 1 || channels > 2) throw new Error(`WAV không hợp lệ: ${channels} kênh`);
      const bytesPerSample = bits / 8;
      const available = Math.min(size, bytes.byteLength - body);
      const frames = Math.floor(available / (bytesPerSample * channels));
      const out = Array.from({ length: channels }, () => new Float32Array(frames));
      for (let f = 0; f < frames; f++) {
        for (let c = 0; c < channels; c++) {
          const p = body + (f * channels + c) * bytesPerSample;
          out[c]![f] = isFloat ? view.getFloat32(p, true) : view.getInt16(p, true) / 32768;
        }
      }
      return { sampleRate, channels: out };
    }
    offset = body + size + (size % 2);
  }
  throw new Error("WAV không hợp lệ: thiếu khối data");
}
