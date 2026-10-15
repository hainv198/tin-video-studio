import { describe, expect, it } from "vitest";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { ValidationError } from "@/domain/errors";

describe("VoiceSettings", () => {
  it("mặc định tốc độ 1.07", () => {
    expect(VoiceSettings.create("vi-VN-Neural2-A").speakingRate).toBe(1.07);
  });

  it("làm tròn tốc độ 2 chữ số", () => {
    expect(VoiceSettings.create("vi-VN-Neural2-A", 1.0749).speakingRate).toBe(1.07);
  });

  it("chặn tốc độ ngoài 0.8–1.3", () => {
    expect(() => VoiceSettings.create("vi-VN-Neural2-A", 0.79)).toThrow(ValidationError);
    expect(() => VoiceSettings.create("vi-VN-Neural2-A", 1.31)).toThrow(ValidationError);
    expect(() => VoiceSettings.create("vi-VN-Neural2-A", Number.NaN)).toThrow(ValidationError);
  });

  it("chặn tên giọng sai dạng", () => {
    expect(() => VoiceSettings.create("hoaimy")).toThrow(ValidationError);
  });

  it("withRate và equals", () => {
    const a = VoiceSettings.create("vi-VN-Neural2-A", 1);
    const b = a.withRate(1.1);
    expect(a.equals(b)).toBe(false);
    expect(b.equals(VoiceSettings.create("vi-VN-Neural2-A", 1.1))).toBe(true);
  });
});
