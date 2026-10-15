/** Bọc PCM 16-bit little-endian thành file WAV (header RIFF 44 byte). */
export function pcm16ToWav(pcm: Uint8Array, sampleRate: number, channels = 1): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, pcm.length, true);
  new Uint8Array(buffer).set(pcm, 44);
  return new Uint8Array(buffer);
}
