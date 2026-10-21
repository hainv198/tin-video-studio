import { describe, expect, it, vi } from "vitest";
import {
  MAX_TEXT_CHARS,
  QUOTA_NOTICE,
  STUDIO_STOPPED_NOTICE,
  VoiceStudioController,
} from "@/client/controllers/VoiceStudioController";
import { SpeechAssembler } from "@/client/media/SpeechAssembler";
import { SpeechChunker } from "@/client/media/SpeechChunker";
import { ApiError } from "@/client/services/apiError";
import type { TtsApi } from "@/client/services/TtsClient";

const SR = 48000;
/** Mỗi ký tự = 10 mẫu có tiếng, để độ dài sau ghép tính được. */
const SAMPLES_PER_CHAR = 10;

function setup(opts: { hold?: Promise<void> } = {}) {
  const calls: { text: string; voice: string; rate: number }[] = [];
  const failOn = new Map<string, ApiError>();
  const tts: TtsApi = {
    voices: async () => [
      { name: "vi-VN-A", gender: "FEMALE", tier: "Google" },
      { name: "vi-VN-B", gender: "MALE", tier: "Edge" },
    ],
    synthesize: async (text, voice, rate, signal) => {
      calls.push({ text, voice, rate });
      if (opts.hold) await opts.hold;
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const fail = failOn.get(text);
      if (fail) throw fail;
      // giải mã giả đọc lại chữ để biết độ dài
      return new TextEncoder().encode(text).buffer as ArrayBuffer;
    },
  };
  const decoder = {
    decode: vi.fn(async (bytes: ArrayBuffer) => {
      const length = new TextDecoder().decode(bytes).length * SAMPLES_PER_CHAR;
      return { channels: [new Float32Array(length).fill(0.5)], sampleRate: SR, durationSec: length / SR };
    }),
  };
  const exporter = { canEncode: vi.fn(async () => true), encode: vi.fn(async () => new Blob(["m4a"], { type: "audio/mp4" })) };
  const authLost = vi.fn();
  const ctrl = new VoiceStudioController({
    tts,
    decoder,
    assembler: new SpeechAssembler(),
    exporter,
    chunker: new SpeechChunker({ maxChars: 4500, maxSentences: 1 }),
    now: () => new Date(2026, 9, 21),
    onAuthLost: authLost,
  });
  return { ctrl, calls, failOn, decoder, exporter, authLost };
}

const TEXT = "Câu một. Câu hai dài hơn. Câu ba.";
const PIECES = ["Câu một.", "Câu hai dài hơn.", "Câu ba."];
const pause = (sec: number) => Math.round(sec * SR);
const totalLength = (pieces: string[], pauseSec: number) =>
  pieces.reduce((s, p) => s + p.length * SAMPLES_PER_CHAR, 0) + (pieces.length - 1) * pause(pauseSec);

async function ready() {
  const made = setup();
  await made.ctrl.loadVoices();
  made.ctrl.setText(TEXT);
  return made;
}

describe("VoiceStudioController", () => {
  it("loadVoices nạp danh sách và chọn giọng đầu", async () => {
    const { ctrl } = setup();
    await ctrl.loadVoices();
    expect(ctrl.state.voices.map((v) => v.name)).toEqual(["vi-VN-A", "vi-VN-B"]);
    expect(ctrl.state.voiceName).toBe("vi-VN-A");
  });

  it("từ chối văn bản trống và văn bản quá 10.000 ký tự, không gọi tạo giọng", async () => {
    const { ctrl, calls } = await ready();
    ctrl.setText("   ");
    await ctrl.generate();
    expect(ctrl.state.error).toMatch(/nhập nội dung/);
    ctrl.setText("a".repeat(MAX_TEXT_CHARS + 1));
    expect(ctrl.state.charCount).toBe(MAX_TEXT_CHARS + 1);
    await ctrl.generate();
    expect(ctrl.state.error).toMatch(/10\.000/);
    expect(calls).toHaveLength(0);
  });

  it("generate gọi tuần tự từng mẩu theo thứ tự, ghép đúng độ dài kể cả khoảng nghỉ", async () => {
    const { ctrl, calls } = await ready();
    const seen: string[] = [];
    ctrl.subscribe(() => {
      const p = ctrl.state.progress;
      if (p) seen.push(`${p.done}/${p.total}`);
    });
    await ctrl.generate();
    expect(calls.map((c) => c.text)).toEqual(PIECES);
    expect(calls[0]).toMatchObject({ voice: "vi-VN-A", rate: 1.07 });
    expect(seen).toContain("1/3");
    expect(seen).toContain("3/3");
    expect(ctrl.state.generating).toBe(false);
    expect(ctrl.state.ready).toBe(true);
    expect(ctrl.state.chunks.map((c) => c.status)).toEqual(["done", "done", "done"]);
    expect(ctrl.buildSamples()!.length).toBe(totalLength(PIECES, 0.35));
  });

  it("đổi khoảng nghỉ và tinh chỉnh không gọi tạo giọng lại", async () => {
    const { ctrl, calls } = await ready();
    await ctrl.generate();
    ctrl.setPause(1);
    expect(ctrl.buildSamples()!.length).toBe(totalLength(PIECES, 1));
    ctrl.setTempo(1.25);
    ctrl.setPitch(-2);
    const expected = PIECES.reduce((s, p) => s + Math.round((p.length * SAMPLES_PER_CHAR) / 1.25), 0) + 2 * pause(1);
    expect(ctrl.buildSamples()!.length).toBe(expected);
    expect(calls).toHaveLength(3);
    ctrl.setPause(5);
    expect(ctrl.state.error).toMatch(/0,10/);
    expect(ctrl.state.pauseSec).toBe(1);
  });

  it("tạo lại chỉ gọi những mẩu đã đổi; đổi giọng thì đọc lại hết", async () => {
    const { ctrl, calls } = await ready();
    await ctrl.generate();
    ctrl.setText("Câu một. Câu hai đã sửa. Câu ba.");
    expect(ctrl.state.ready).toBe(false);
    expect(ctrl.state.outdated).toBe(true);
    await ctrl.generate();
    expect(calls.map((c) => c.text)).toEqual([...PIECES, "Câu hai đã sửa."]);
    expect(ctrl.state.ready).toBe(true);
    ctrl.selectVoice("vi-VN-B");
    expect(ctrl.state.ready).toBe(false);
    await ctrl.generate();
    expect(calls).toHaveLength(7);
    expect(calls[6]).toMatchObject({ voice: "vi-VN-B" });
  });

  it("Dừng có hiệu lực ngay: trạng thái về rảnh, không gọi tiếp, mẩu đã xong giữ nguyên", async () => {
    let release!: () => void;
    const hold = new Promise<void>((r) => (release = r));
    const { ctrl, calls } = setup({ hold });
    await ctrl.loadVoices();
    ctrl.setText(TEXT);
    const run = ctrl.generate();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    ctrl.cancel();
    expect(ctrl.state.generating).toBe(false);
    expect(ctrl.state.progress).toBeNull();
    expect(ctrl.state.notice).toBe(STUDIO_STOPPED_NOTICE);
    release();
    await run;
    expect(calls).toHaveLength(1);
    expect(ctrl.state.ready).toBe(false);
    expect(ctrl.state.chunks.map((c) => c.status)).toEqual(["pending", "pending", "pending"]);
  });

  it("lỗi một mẩu: ghi rõ mẩu nào, các mẩu khác xong; Thử lại mẩu này sửa được", async () => {
    const { ctrl, failOn, calls } = await ready();
    failOn.set(PIECES[1]!, new ApiError(502, "UPSTREAM", "Dịch vụ giọng đọc lỗi, thử lại sau"));
    await ctrl.generate();
    expect(ctrl.state.chunks.map((c) => c.status)).toEqual(["done", "failed", "done"]);
    expect(ctrl.state.chunks[1]!.error).toBe("Dịch vụ giọng đọc lỗi, thử lại sau");
    expect(ctrl.state.ready).toBe(false);
    expect(ctrl.buildSamples()).toBeNull();
    failOn.clear();
    await ctrl.retry(1);
    expect(calls.map((c) => c.text)).toEqual([...PIECES, PIECES[1]]);
    expect(ctrl.state.chunks[1]!.status).toBe("done");
    expect(ctrl.state.ready).toBe(true);
  });

  it("hết hạn mức (429 QUOTA): dừng cả lượt, báo tiếng Việt rõ ràng, mẩu sau chưa gọi", async () => {
    const { ctrl, failOn, calls } = await ready();
    failOn.set(PIECES[1]!, new ApiError(429, "QUOTA", "Hết hạn mức giọng đọc hôm nay"));
    await ctrl.generate();
    expect(calls).toHaveLength(2);
    expect(ctrl.state.error).toBe(QUOTA_NOTICE);
    expect(ctrl.state.chunks.map((c) => c.status)).toEqual(["done", "failed", "pending"]);
    expect(ctrl.state.generating).toBe(false);
  });

  it("hết phiên (401): dừng lượt và báo lên trên", async () => {
    const { ctrl, failOn, calls, authLost } = await ready();
    failOn.set(PIECES[0]!, new ApiError(401, "AUTH", "Phiên đăng nhập đã hết hạn"));
    await ctrl.generate();
    expect(calls).toHaveLength(1);
    expect(authLost).toHaveBeenCalled();
  });

  it("xuất WAV mono 48 kHz kèm tên file gợi ý; xuất M4A qua bộ mã hoá", async () => {
    const { ctrl, exporter } = await ready();
    expect(await ctrl.exportAudio("wav")).toBeNull();
    await ctrl.generate();
    const wav = (await ctrl.exportAudio("wav"))!;
    expect(wav.fileName).toBe("cau-mot-cau-hai-dai-hon_20261021.wav");
    const bytes = new Uint8Array(await wav.blob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(SR);
    expect(view.getUint32(40, true)).toBe(totalLength(PIECES, 0.35) * 2);
    const m4a = (await ctrl.exportAudio("m4a"))!;
    expect(m4a.fileName).toBe("cau-mot-cau-hai-dai-hon_20261021.m4a");
    expect(exporter.encode).toHaveBeenCalledWith(expect.any(Float32Array), SR);
  });

  it("checkM4a ghi nhận trình duyệt có mã hoá AAC hay không", async () => {
    const { ctrl, exporter } = setup();
    exporter.canEncode.mockResolvedValueOnce(false);
    await ctrl.checkM4a();
    expect(ctrl.state.m4aSupported).toBe(false);
  });
});
