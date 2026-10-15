import { describe, expect, it, vi } from "vitest";
import { VoiceController } from "@/client/controllers/VoiceController";
import { stepReady } from "@/client/controllers/readiness";
import { ApiError } from "@/client/services/apiError";
import type { TtsApi } from "@/client/services/TtsClient";
import { makeSessionWithProject } from "../../helpers/studioFixtures";

function setup(opts: { hold?: Promise<void> } = {}) {
  const made = makeSessionWithProject(2); // s1 mở đầu, s2, s3
  const calls: string[] = [];
  const failOn = new Set<string>();
  const tts: TtsApi = {
    voices: async () => [
      { name: "vi-VN-A", gender: "FEMALE", tier: "Edge" },
      { name: "vi-VN-B", gender: "MALE", tier: "Edge" },
    ],
    synthesize: async (text) => {
      calls.push(text);
      if (opts.hold) await opts.hold;
      if (failOn.has(text)) throw new ApiError(429, "QUOTA", "Hết hạn mức giọng đọc hôm nay, liên hệ Hải");
      return new Uint8Array([1, 2, 3, 4]).buffer;
    },
  };
  const decoder = { decode: vi.fn(async () => ({ channels: [new Float32Array(48)], sampleRate: 48000, durationSec: 1.5 })) };
  const authLost = vi.fn();
  const ctrl = new VoiceController({ session: made.session, tts, decoder, onAuthLost: authLost });
  return { ...made, ctrl, calls, failOn, authLost, decoder };
}

describe("VoiceController", () => {
  it("loadVoices nạp danh sách và chọn giọng đầu khi chưa có; giữ giọng đã chọn", async () => {
    const { ctrl, session } = setup();
    session.update((d) => ({ ...d, voice: null }));
    await ctrl.loadVoices();
    expect(ctrl.state.voices.map((v) => v.name)).toEqual(["vi-VN-A", "vi-VN-B"]);
    expect(session.state.voice?.voiceName).toBe("vi-VN-A");
    ctrl.selectVoice("vi-VN-B");
    await ctrl.loadVoices();
    expect(session.state.voice?.voiceName).toBe("vi-VN-B");
  });

  it("selectVoice giữ tốc độ; setRate đổi tốc độ và làm giọng cũ đi", async () => {
    const { ctrl, session } = setup();
    ctrl.setRate(1.2);
    ctrl.selectVoice("vi-VN-B");
    expect(session.state.voice?.speakingRate).toBe(1.2);
    ctrl.setRate(5);
    expect(ctrl.state.error).not.toBeNull();
    expect(session.state.voice?.speakingRate).toBe(1.2);
  });

  it("generate tạo giọng cho mọi cảnh, lưu MP3 gốc và độ dài chưa cắt", async () => {
    const { ctrl, session } = setup();
    await ctrl.generate();
    expect(session.state.narrations.size).toBe(3);
    const n = session.state.narrations.get("s2")!;
    expect(Array.from(n.audio)).toEqual([1, 2, 3, 4]);
    expect(n.durationSec).toBe(1.5);
    expect(ctrl.state.generating).toBe(false);
    expect(ctrl.state.progress).toBeNull();
    expect(stepReady("voice", session.state)).toBe(true);
  });

  it("chỉ tạo lại cảnh cũ: sửa chữ một cảnh thì chỉ cảnh đó đọc lại", async () => {
    const { ctrl, session, calls } = setup();
    await ctrl.generate();
    expect(calls).toHaveLength(3);
    await ctrl.generate();
    expect(calls).toHaveLength(3);
    session.update((d) => ({ ...d, project: d.project!.updateSceneText("s2", "Câu đã sửa lại.") }));
    await ctrl.generate();
    expect(calls).toHaveLength(4);
    expect(calls[3]).toBe("Câu đã sửa lại.");
  });

  it("lỗi một câu được ghi lại, các câu khác vẫn xong; retry sửa được", async () => {
    const { ctrl, session, failOn } = setup();
    const target = session.state.project!.sceneById("s2").text;
    failOn.add(target);
    await ctrl.generate();
    expect(session.state.narrations.size).toBe(2);
    expect(ctrl.state.failed).toEqual({ s2: "Hết hạn mức giọng đọc hôm nay, liên hệ Hải" });
    expect(stepReady("voice", session.state)).toBe(false);
    failOn.clear();
    await ctrl.retry("s2");
    expect(session.state.narrations.has("s2")).toBe(true);
    expect(ctrl.state.failed).toEqual({});
    expect(stepReady("voice", session.state)).toBe(true);
  });

  it("hết phiên (401) thì dừng cả lượt và báo onAuthLost một lần", async () => {
    const made = setup();
    const unauthorized: TtsApi = {
      voices: async () => [],
      synthesize: async () => {
        throw new ApiError(401, "AUTH", "Chưa đăng nhập");
      },
    };
    const ctrl = new VoiceController({ session: made.session, tts: unauthorized, decoder: made.decoder, onAuthLost: made.authLost });
    await ctrl.generate();
    expect(made.authLost).toHaveBeenCalledTimes(1);
    expect(made.session.state.narrations.size).toBe(0);
  });

  it("cancel dừng lượt đang chạy và không lưu kết quả về sau", async () => {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    const { ctrl, session } = setup({ hold });
    const run = ctrl.generate();
    ctrl.cancel();
    release();
    await run;
    expect(session.state.narrations.size).toBe(0);
    expect(ctrl.state.generating).toBe(false);
  });

  it("kết quả về sau khi đã đổi giọng thì bỏ; các cảnh sau đọc theo giọng mới", async () => {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    const { ctrl, session } = setup({ hold });
    const run = ctrl.generate();
    ctrl.setRate(1.25);
    release();
    await run;
    expect(session.state.narrations.has("s1")).toBe(false); // cảnh đang đọc dở theo giọng cũ bị bỏ
    expect(session.state.narrations.get("s2")?.voice.speakingRate).toBe(1.25);
    expect(session.state.narrations.get("s3")?.voice.speakingRate).toBe(1.25);
  });

  it("previewVoice đọc câu tiêu đề và trả Blob audio/mpeg", async () => {
    const { ctrl, calls } = setup();
    const blob = await ctrl.previewVoice();
    expect(blob?.type).toBe("audio/mpeg");
    expect(calls).toEqual(["Tiêu đề bản tin"]);
    expect(ctrl.state.previewing).toBe(false);
  });

  it("chưa có dự án hoặc giọng thì báo lỗi, không gọi TTS", async () => {
    const { ctrl, session, calls } = setup();
    session.update((d) => ({ ...d, voice: null }));
    await ctrl.generate();
    expect(ctrl.state.error).toBe("Chưa chọn giọng");
    expect(await ctrl.previewVoice()).toBeNull();
    expect(calls).toEqual([]);
  });

  it("reset xoá lỗi từng câu, lỗi chung và tiến độ của dự án cũ", async () => {
    const { ctrl, session, failOn } = setup();
    failOn.add(session.state.project!.scenes[1]!.text);
    await ctrl.generate();
    expect(Object.keys(ctrl.state.failed).length).toBe(1);
    ctrl.reset();
    expect(ctrl.state.failed).toEqual({});
    expect(ctrl.state.error).toBeNull();
    expect(ctrl.state.progress).toBeNull();
    expect(ctrl.state.generating).toBe(false);
  });
});
