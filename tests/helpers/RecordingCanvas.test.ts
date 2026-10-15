import { describe, expect, it } from "vitest";
import { RecordingCanvas } from "./RecordingCanvas";

describe("RecordingCanvas", () => {
  it("ghi lệnh kèm trạng thái, đo chữ theo cỡ font", () => {
    const c = new RecordingCanvas();
    c.font = "800 64px X";
    c.fillText("ABCD", 1, 2);
    expect(c.texts()).toEqual(["ABCD"]);
    expect(c.ops("fillText")[0]?.state.font).toBe("800 64px X");
    expect(c.measureText("ABCD").width).toBe(128);
  });
});
