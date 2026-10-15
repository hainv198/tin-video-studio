import { describe, expect, it } from "vitest";
import { BrowserSupport } from "@/client/render/BrowserSupport";

const allGlobals = { VideoEncoder: class {}, AudioEncoder: class {}, OffscreenCanvas: class {}, Worker: class {} };
const yes = async () => true;
const no = async () => false;

describe("BrowserSupport", () => {
  it("đủ API và mã hoá được thì ok", async () => {
    expect(await new BrowserSupport(allGlobals, { canEncodeVideo: yes, canEncodeAudio: yes }).check()).toEqual({
      ok: true,
      missing: [],
    });
  });

  it("thiếu API thì liệt kê, không gọi kiểm mã hoá", async () => {
    let called = false;
    const spy = async () => {
      called = true;
      return true;
    };
    const r = await new BrowserSupport({ Worker: class {} }, { canEncodeVideo: spy, canEncodeAudio: spy }).check();
    expect(r).toEqual({ ok: false, missing: ["VideoEncoder", "AudioEncoder", "OffscreenCanvas"] });
    expect(called).toBe(false);
  });

  it("không mã hoá được H.264 1080×1920 hoặc AAC thì báo", async () => {
    const r = await new BrowserSupport(allGlobals, { canEncodeVideo: no, canEncodeAudio: no }).check();
    expect(r).toEqual({ ok: false, missing: ["Mã hoá H.264 1080×1920", "Mã hoá AAC 48 kHz stereo"] });
  });
});
