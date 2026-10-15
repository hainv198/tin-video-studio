import { describe, expect, it } from "vitest";
import { CanvasBackdropMaker } from "@/client/render/BackdropMaker";
import type { DrawableImage } from "@/templates/VideoTemplate";
import { RecordingCanvas } from "../../helpers/RecordingCanvas";

const canvasToken = { tag: "backdrop-canvas" } as unknown as CanvasImageSource;
const make = () => {
  const rec = new RecordingCanvas();
  const calls: Array<[number, number]> = [];
  const maker = new CanvasBackdropMaker((w, h) => {
    calls.push([w, h]);
    return { canvas: canvasToken, ctx: rec.asCanvas() };
  });
  return { rec, calls, maker };
};

describe("CanvasBackdropMaker", () => {
  it("tạo một bề mặt 135×240 duy nhất", () => {
    const { calls } = make();
    expect(calls).toEqual([[135, 240]]);
  });

  it("phủ ảnh ngang kín khung nhỏ (cover, căn giữa) với nội suy chất lượng cao", () => {
    const { rec, maker } = make();
    const image: DrawableImage = { source: { tag: "img" } as unknown as CanvasImageSource, width: 1600, height: 900 };
    const out = maker.make(image);
    expect(out).toEqual({ source: canvasToken, width: 135, height: 240 });
    const draw = rec.ops("drawImage")[0];
    expect(draw?.args[0]).toBe(image.source);
    expect(Number(draw?.args[1])).toBeCloseTo((135 - (1600 * 240) / 900) / 2, 6);
    expect(Number(draw?.args[2])).toBeCloseTo(0, 6);
    expect(Number(draw?.args[3])).toBeCloseTo((1600 * 240) / 900, 6);
    expect(Number(draw?.args[4])).toBeCloseTo(240, 6);
    expect(draw?.state.imageSmoothingEnabled).toBe(true);
    expect(draw?.state.imageSmoothingQuality).toBe("high");
  });

  it("tô nền đen trước khi vẽ để ảnh trong suốt không để lại hình cũ", () => {
    const { rec, maker } = make();
    maker.make({ source: {} as CanvasImageSource, width: 100, height: 100 });
    const ops = rec.calls.map((c) => c.op);
    expect(ops.indexOf("fillRect")).toBeLessThan(ops.indexOf("drawImage"));
    expect(rec.ops("fillRect")[0]?.args).toEqual([0, 0, 135, 240]);
  });

  it("ảnh dọc phủ kín theo chiều ngang", () => {
    const { rec, maker } = make();
    maker.make({ source: {} as CanvasImageSource, width: 900, height: 1600 });
    const draw = rec.ops("drawImage")[0];
    expect(Number(draw?.args[3])).toBeCloseTo(135, 6);
    expect(Number(draw?.args[2])).toBeCloseTo((240 - (1600 * 135) / 900) / 2, 6);
  });
});
