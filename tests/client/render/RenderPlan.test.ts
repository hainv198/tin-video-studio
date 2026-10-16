import { describe, expect, it } from "vitest";
import { DEFAULT_TIMELINE_CONFIG } from "@/domain/Timeline";
import { VideoOptions } from "@/domain/VideoOptions";
import { planRender, timelineConfigFor } from "@/client/render/RenderPlan";
import type { RenderJob } from "@/client/render/RenderJob";

const job = (narrations: RenderJob["narrations"]): RenderJob => ({
  templateId: "theanh28",
  brandValues: {},
  logo: null,
  project: { displayTitle: "T", sourceCredit: "", publishDateText: "14/10/2026" },
  scenes: [
    { sceneId: "s1", role: "intro", text: "T", footage: { kind: "fallback" } },
    { sceneId: "s2", role: "body", text: "B", footage: { kind: "fallback" } },
  ],
  narrations,
  music: null,
  sampleRate: 48000,
  origin: "http://localhost:3100",
  options: VideoOptions.defaults().snapshot(),
});

describe("planRender", () => {
  it("dựng timeline theo thứ tự cảnh, giọng đặt ở voiceStart", () => {
    const a = new Float32Array(3);
    const b = new Float32Array(4);
    const plan = planRender(
      job([
        { sceneId: "s2", durationSec: 1, samples: b },
        { sceneId: "s1", durationSec: 2, samples: a },
      ]),
      DEFAULT_TIMELINE_CONFIG,
    );
    expect(plan.timeline.slots.map((s) => s.sceneId)).toEqual(["s1", "s2"]);
    expect(plan.voices).toEqual([
      { startSec: 0.3, samples: a },
      { startSec: 2.65, samples: b },
    ]);
    expect(plan.timeline.totalDuration).toBeCloseTo(4.25, 9);
  });

  it("cảnh thiếu giọng thì báo lỗi rõ", () => {
    expect(() => planRender(job([{ sceneId: "s1", durationSec: 1, samples: new Float32Array(1) }]), DEFAULT_TIMELINE_CONFIG)).toThrow(
      "Cảnh s2 chưa có giọng đọc",
    );
  });

  it("timelineConfigFor lấy gapSec/leadInSec từ tuỳ chọn, giữ tailSec của mẫu; đổi nhịp đổi đúng tổng thời lượng", () => {
    const narr = [
      { sceneId: "s1", durationSec: 2, samples: new Float32Array(1) },
      { sceneId: "s2", durationSec: 1, samples: new Float32Array(1) },
    ];
    const base = planRender(job(narr), timelineConfigFor(DEFAULT_TIMELINE_CONFIG, VideoOptions.defaults().snapshot()));
    expect(base.timeline.totalDuration).toBeCloseTo(0.3 + 2 + 0.35 + 1 + 0.6, 9);
    const o = VideoOptions.defaults().withGapSec(0.75).withLeadInSec(0.5).snapshot();
    expect(timelineConfigFor(DEFAULT_TIMELINE_CONFIG, o)).toEqual({ leadInSec: 0.5, gapSec: 0.75, tailSec: 0.6 });
    const slow = planRender(job(narr), timelineConfigFor(DEFAULT_TIMELINE_CONFIG, o));
    expect(slow.timeline.totalDuration).toBeCloseTo(0.5 + 2 + 0.75 + 1 + 0.6, 9);
    expect(slow.voices[1]?.startSec).toBeCloseTo(0.5 + 2 + 0.75, 9);
  });
});
