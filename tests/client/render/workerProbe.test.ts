import { describe, expect, it } from "vitest";
import { probeWorkerScope } from "@/client/render/workerProbe";

const ctx = () => ({});

describe("probeWorkerScope", () => {
  it("đủ khả năng thì không thiếu gì", () => {
    expect(probeWorkerScope({ fonts: {}, OffscreenCanvas: class {} }, ctx)).toEqual([]);
  });

  it("thiếu fonts", () => {
    expect(probeWorkerScope({ OffscreenCanvas: class {} }, ctx)).toEqual(["Nạp font trong worker"]);
  });

  it("thiếu OffscreenCanvas thì không thử tạo canvas", () => {
    let called = false;
    const missing = probeWorkerScope({ fonts: {} }, () => {
      called = true;
      return {};
    });
    expect(missing).toEqual(["OffscreenCanvas"]);
    expect(called).toBe(false);
  });

  it("không cấp được context 2D (null hoặc ném lỗi)", () => {
    expect(probeWorkerScope({ fonts: {}, OffscreenCanvas: class {} }, () => null)).toEqual(["Canvas 2D trong worker"]);
    expect(
      probeWorkerScope({ fonts: {}, OffscreenCanvas: class {} }, () => {
        throw new Error("x");
      }),
    ).toEqual(["Canvas 2D trong worker"]);
  });

  it("thiếu nhiều thứ thì liệt kê đủ", () => {
    expect(probeWorkerScope({}, ctx)).toEqual(["Nạp font trong worker", "OffscreenCanvas"]);
  });
});
