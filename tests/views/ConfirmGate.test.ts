import { describe, expect, it, vi } from "vitest";
import { ConfirmGate, type ConfirmScheduler } from "@/views/hooks/ConfirmGate";

function fakeScheduler() {
  let fn: (() => void) | null = null;
  const scheduler: ConfirmScheduler = {
    set: (f) => {
      fn = f;
      return 1;
    },
    clear: () => {
      fn = null;
    },
  };
  return { scheduler, fire: () => fn?.(), pending: () => fn !== null };
}

describe("ConfirmGate", () => {
  it("bắt đầu ở idle; confirm khi chưa arm không chạy hành động", () => {
    const g = new ConfirmGate(100, fakeScheduler().scheduler);
    expect(g.armed).toBe(false);
    expect(g.confirm()).toBe(false);
  });

  it("arm rồi confirm trả true và về idle", () => {
    const s = fakeScheduler();
    const g = new ConfirmGate(100, s.scheduler);
    const l = vi.fn();
    g.subscribe(l);
    g.arm();
    expect(g.armed).toBe(true);
    expect(g.confirm()).toBe(true);
    expect(g.armed).toBe(false);
    expect(s.pending()).toBe(false);
    expect(l).toHaveBeenCalledTimes(2);
    expect(g.confirm()).toBe(false);
  });

  it("huỷ về idle và confirm sau đó không chạy", () => {
    const g = new ConfirmGate(100, fakeScheduler().scheduler);
    g.arm();
    g.cancel();
    expect(g.armed).toBe(false);
    expect(g.confirm()).toBe(false);
  });

  it("hết giờ tự về idle", () => {
    const s = fakeScheduler();
    const g = new ConfirmGate(100, s.scheduler);
    g.arm();
    s.fire();
    expect(g.armed).toBe(false);
  });

  it("arm hai lần chỉ đặt một bộ hẹn; dispose dọn bộ hẹn", () => {
    const s = fakeScheduler();
    const set = vi.spyOn(s.scheduler, "set");
    const g = new ConfirmGate(100, s.scheduler);
    g.arm();
    g.arm();
    expect(set).toHaveBeenCalledTimes(1);
    g.dispose();
    expect(s.pending()).toBe(false);
  });
});
