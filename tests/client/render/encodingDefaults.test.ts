import { describe, expect, it } from "vitest";
import { RENDER_AUDIO_BITRATE, RENDER_VIDEO_BITRATE, VIDEO_BITRATE_CHOICES } from "@/client/render/encodingDefaults";

describe("encodingDefaults", () => {
  it("mặc định 8 Mbps hình, 192 kbps tiếng; có lựa chọn 5 Mbps", () => {
    expect(RENDER_VIDEO_BITRATE).toBe(8_000_000);
    expect(RENDER_AUDIO_BITRATE).toBe(192_000);
    expect(VIDEO_BITRATE_CHOICES).toEqual({ standard: 8_000_000, light: 5_000_000 });
    expect(VIDEO_BITRATE_CHOICES.standard).toBe(RENDER_VIDEO_BITRATE);
  });
});
