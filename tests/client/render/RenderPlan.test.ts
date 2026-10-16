import { describe, expect, it } from "vitest";
import { DEFAULT_TIMELINE_CONFIG, Timeline } from "@/domain/Timeline";
import { VideoOptions } from "@/domain/VideoOptions";
import { footageSpans, planRender, timelineConfigFor } from "@/client/render/RenderPlan";
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

describe("footageSpans", () => {
  // a: 0 → 1,35 ; b: 1,35 → 2,2 ; c: 2,2 → 3,3
  const timeline = Timeline.build([
    { sceneId: "a", durationSec: 0.7 },
    { sceneId: "b", durationSec: 0.5 },
    { sceneId: "c", durationSec: 0.5 },
  ]);

  it("mặc định: mỗi đoạn một khoảng cảnh trám đúng bằng khe của nó", () => {
    const spans = footageSpans(timeline, new Map());
    for (const slot of timeline.slots) {
      expect(spans.get(slot.sceneId)).toEqual({ ownerId: slot.sceneId, start: slot.start, end: slot.end });
    }
  });

  it("đoạn dùng tiếp chung một khoảng với chủ cảnh: từ đầu chủ cảnh tới hết đoạn cuối của nhóm", () => {
    const spans = footageSpans(timeline, new Map([["b", "a"], ["c", "a"]]));
    const end = timeline.slots[2]!.end;
    expect(spans.get("a")).toEqual({ ownerId: "a", start: 0, end });
    expect(spans.get("b")).toEqual({ ownerId: "a", start: 0, end });
    expect(spans.get("c")).toEqual({ ownerId: "a", start: 0, end });
    const partial = footageSpans(timeline, new Map([["b", "a"]]));
    expect(partial.get("b")).toEqual({ ownerId: "a", start: 0, end: timeline.slots[1]!.end });
    expect(partial.get("c")).toEqual({ ownerId: "c", start: timeline.slots[2]!.start, end: timeline.slots[2]!.end });
  });
});
