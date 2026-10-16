import { describe, expect, it } from "vitest";
import { canContinueFootage, pairedContinuations, resolveFootageSource } from "@/domain/footageGroups";

const scenes = [
  { id: "s1", role: "intro" as const },
  { id: "s2", role: "body" as const },
  { id: "s3", role: "body" as const },
  { id: "s4", role: "body" as const },
  { id: "s5", role: "body" as const },
  { id: "s6", role: "body" as const },
];

describe("resolveFootageSource", () => {
  it("mặc định (không đoạn nào dùng tiếp): mỗi đoạn là chủ cảnh của chính nó", () => {
    const owners = resolveFootageSource(scenes, new Set());
    expect([...owners]).toEqual(scenes.map((s) => [s.id, s.id]));
  });

  it("đoạn dùng tiếp trỏ tới đoạn gần nhất phía trước có cảnh riêng, kể cả chuỗi nhiều đoạn liền", () => {
    const owners = resolveFootageSource(scenes, new Set(["s3", "s4", "s6"]));
    expect(Object.fromEntries(owners)).toEqual({ s1: "s1", s2: "s2", s3: "s2", s4: "s2", s5: "s5", s6: "s5" });
  });

  it("đoạn mở đầu và đoạn đầu tiên không bao giờ dùng tiếp; id lạ bị bỏ qua", () => {
    const owners = resolveFootageSource(scenes, new Set(["s1", "khong-co"]));
    expect(owners.get("s1")).toBe("s1");
    expect(owners.has("khong-co")).toBe(false);
    const noIntro = [
      { id: "a", role: "body" as const },
      { id: "b", role: "body" as const },
    ];
    expect(Object.fromEntries(resolveFootageSource(noIntro, new Set(["a", "b"])))).toEqual({ a: "a", b: "a" });
  });

  it("đoạn thân bài ngay sau mở đầu dùng tiếp được cảnh của mở đầu", () => {
    expect(resolveFootageSource(scenes, new Set(["s2"])).get("s2")).toBe("s1");
  });

  it("danh sách rỗng trả map rỗng", () => {
    expect(resolveFootageSource([], new Set(["x"])).size).toBe(0);
  });
});

describe("canContinueFootage / pairedContinuations", () => {
  it("chỉ đoạn thân bài không đứng đầu mới được dùng tiếp", () => {
    expect(canContinueFootage(scenes, "s1")).toBe(false);
    expect(canContinueFootage(scenes, "s2")).toBe(true);
    expect(canContinueFootage(scenes, "khong-co")).toBe(false);
    expect(canContinueFootage([{ id: "a", role: "body" }], "a")).toBe(false);
  });

  it("gộp mỗi 2 đoạn thân bài một cảnh: đoạn thứ 2, 4… của thân bài dùng tiếp; mở đầu giữ riêng", () => {
    expect(pairedContinuations(scenes)).toEqual(["s3", "s5"]);
    expect(pairedContinuations(scenes.slice(0, 2))).toEqual([]);
  });
});
