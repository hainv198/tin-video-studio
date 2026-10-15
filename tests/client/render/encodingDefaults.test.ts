import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIDEO_QUALITY,
  RENDER_AUDIO_BITRATE,
  RENDER_VIDEO_BITRATE,
  VIDEO_BITRATE_CHOICES,
  VIDEO_QUALITY_LABELS,
} from "@/client/render/encodingDefaults";

describe("encodingDefaults", () => {
  it("mặc định 8 Mbps hình, 192 kbps tiếng; có lựa chọn 5 Mbps", () => {
    expect(RENDER_VIDEO_BITRATE).toBe(8_000_000);
    expect(RENDER_AUDIO_BITRATE).toBe(192_000);
    expect(VIDEO_BITRATE_CHOICES).toEqual({ standard: 8_000_000, light: 5_000_000 });
    expect(VIDEO_BITRATE_CHOICES.standard).toBe(RENDER_VIDEO_BITRATE);
  });

  it("nhãn chất lượng cho mọi lựa chọn; mặc định là chuẩn", () => {
    expect(Object.keys(VIDEO_QUALITY_LABELS).sort()).toEqual(Object.keys(VIDEO_BITRATE_CHOICES).sort());
    expect(VIDEO_QUALITY_LABELS.standard).toBe("Chuẩn (8 Mbps, nét nhất)");
    expect(VIDEO_QUALITY_LABELS.light).toBe("Nhẹ (5 Mbps, nhỏ hơn ≈ 1/3, nhìn không khác)");
    expect(DEFAULT_VIDEO_QUALITY).toBe("standard");
  });
});
