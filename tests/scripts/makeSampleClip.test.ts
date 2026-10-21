import { describe, expect, it } from "vitest";
import { sampleClipArgs } from "../../scripts/make-sample-clip";

describe("sampleClipArgs", () => {
  it("có tiếng: testsrc2 + sin 440 Hz ở 44,1 kHz, H.264 yuv420p + AAC", () => {
    const args = sampleClipArgs({ out: "a.mp4", seconds: 8, width: 1280, height: 720, audio: true });
    expect(args).toEqual([
      "-v", "error", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=8",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=8",
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-g", "60",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart", "a.mp4",
    ]);
  });

  it("không tiếng: -an", () => {
    const args = sampleClipArgs({ out: "b.mp4", seconds: 5, width: 640, height: 360, audio: false });
    expect(args).toContain("-an");
    expect(args.join(" ")).not.toContain("sine=");
  });
});
