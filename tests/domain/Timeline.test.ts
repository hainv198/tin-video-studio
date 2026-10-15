import { describe, expect, it } from "vitest";
import { DEFAULT_TIMELINE_CONFIG, Timeline } from "@/domain/Timeline";
import { ValidationError } from "@/domain/errors";

const entries = [
  { sceneId: "a", durationSec: 5.4 },
  { sceneId: "b", durationSec: 6.6 },
  { sceneId: "c", durationSec: 3.9 },
];

describe("Timeline.build", () => {
  it("dùng cấu hình mặc định 0.3 / 0.35 / 0.6", () => {
    expect(DEFAULT_TIMELINE_CONFIG).toEqual({ leadInSec: 0.3, gapSec: 0.35, tailSec: 0.6 });
  });

  it("tính mốc từng cảnh liền nhau", () => {
    const t = Timeline.build(entries);
    expect(t.slots).toEqual([
      { sceneId: "a", index: 0, start: 0, voiceStart: 0.3, voiceEnd: 5.7, end: 6.05 },
      { sceneId: "b", index: 1, start: 6.05, voiceStart: 6.05, voiceEnd: 12.65, end: 13 },
      { sceneId: "c", index: 2, start: 13, voiceStart: 13, voiceEnd: 16.9, end: 17.5 },
    ]);
    expect(t.totalDuration).toBe(17.5);
  });

  it("báo lỗi khi không có cảnh hoặc cảnh chưa có giọng", () => {
    expect(() => Timeline.build([])).toThrow(ValidationError);
    expect(() => Timeline.build([{ sceneId: "a", durationSec: 0 }])).toThrow("Cảnh a chưa có độ dài giọng");
  });
});

describe("Timeline tra cứu", () => {
  const t = Timeline.build(entries);

  it("slotAt trả cảnh đang chiếu", () => {
    expect(t.slotAt(0).sceneId).toBe("a");
    expect(t.slotAt(6.049).sceneId).toBe("a");
    expect(t.slotAt(6.05).sceneId).toBe("b");
    expect(t.slotAt(16.95).sceneId).toBe("c");
  });

  it("slotAt kẹp ngoài biên", () => {
    expect(t.slotAt(-1).sceneId).toBe("a");
    expect(t.slotAt(99).sceneId).toBe("c");
  });

  it("frameCount làm tròn lên", () => {
    expect(t.frameCount(30)).toBe(525);
    expect(Timeline.build([{ sceneId: "x", durationSec: 0.1 }]).frameCount(30)).toBe(30);
  });
});
