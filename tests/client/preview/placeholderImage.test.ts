import { describe, expect, it } from "vitest";
import { drawPlaceholder, PLACEHOLDER_LABEL, PLACEHOLDER_SIZE } from "@/client/preview/placeholderImage";
import { RecordingCanvas } from "../../helpers/RecordingCanvas";

describe("drawPlaceholder", () => {
  it("vẽ gradient phủ khung, vài hình đơn giản và nhãn nhỏ 'ảnh minh hoạ'", () => {
    const c = new RecordingCanvas();
    drawPlaceholder(c.asCanvas());
    expect(c.ops("createLinearGradient")).toHaveLength(1);
    expect(c.ops("fillRect")[0]?.args).toEqual([0, 0, PLACEHOLDER_SIZE.width, PLACEHOLDER_SIZE.height]);
    expect(c.ops("arc").length).toBeGreaterThan(0);
    const label = c.ops("fillText").find((x) => x.args[0] === PLACEHOLDER_LABEL);
    expect(PLACEHOLDER_LABEL).toBe("ảnh minh hoạ");
    expect(Number(/(\d+)px/.exec(label?.state.font ?? "")?.[1])).toBeLessThanOrEqual(28);
  });
});
