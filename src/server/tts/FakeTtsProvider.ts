import type { SynthesisRequest, SynthesisResult, TtsProvider, TtsVoice } from "./TtsProvider";

export function makeToneWav(seconds: number, frequency: number, sampleRate = 24000): Uint8Array<ArrayBuffer> {
  const samples = Math.round(seconds * sampleRate);
  const dataBytes = samples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t * 20, (seconds - t) * 20);
    view.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * frequency * t) * 6000 * envelope), true);
  }
  return new Uint8Array(buffer);
}

export class FakeTtsProvider implements TtsProvider {
  async listVoices(): Promise<TtsVoice[]> {
    return [
      { name: "vi-VN-Fake-A", gender: "FEMALE", tier: "Fake" },
      { name: "vi-VN-Fake-B", gender: "MALE", tier: "Fake" },
    ];
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const seconds = Math.min(30, Math.max(0.5, request.text.length * 0.065)) / request.speakingRate;
    const frequency = request.voiceName.endsWith("-B") ? 140 : 230;
    return { audio: makeToneWav(seconds, frequency), mimeType: "audio/wav" };
  }
}
