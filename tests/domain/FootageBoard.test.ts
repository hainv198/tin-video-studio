import { describe, expect, it } from "vitest";
import { FootageBoard } from "@/domain/FootageBoard";
import { FallbackFootage, ImageFootage } from "@/domain/Footage";
import { ValidationError } from "@/domain/errors";

const img = (id: string) => new ImageFootage(id, { origin: "upload", uri: `idb:${id}` }, 100, 100);
const order = ["s1", "s2", "s3", "s4"];

describe("FootageBoard", () => {
  it("fillInOrder gán lần lượt vào cảnh còn trống, giữ cảnh đã gán", () => {
    const board = FootageBoard.empty().assign("s2", img("x")).fillInOrder(order, [img("a"), img("b")]);
    expect(board.get("s1")?.id).toBe("a");
    expect(board.get("s2")?.id).toBe("x");
    expect(board.get("s3")?.id).toBe("b");
    expect(board.get("s4")).toBeUndefined();
    expect(board.unassignedSceneIds(order)).toEqual(["s4"]);
  });

  it("một cảnh trám dùng được cho nhiều cảnh", () => {
    const a = img("a");
    const board = FootageBoard.empty().assign("s1", a).assign("s3", a);
    expect(board.get("s1")).toBe(board.get("s3"));
  });

  it("swap hoán đổi hai cảnh, kể cả khi một bên trống", () => {
    const board = FootageBoard.empty().assign("s1", img("a")).swap("s1", "s2");
    expect(board.get("s1")).toBeUndefined();
    expect(board.get("s2")?.id).toBe("a");
  });

  it("bất biến: thao tác trả bảng mới", () => {
    const a = FootageBoard.empty();
    const b = a.assign("s1", img("a"));
    expect(a.get("s1")).toBeUndefined();
    expect(b.unassign("s1").get("s1")).toBeUndefined();
  });

  it("resolve trả nền dự phòng khi chưa gán", () => {
    expect(FootageBoard.empty().resolve("s1")).toBeInstanceOf(FallbackFootage);
  });
});

describe("FootageBoard snapshot / restore", () => {
  it("round trip: giữ cảnh trống, dùng chung một cảnh trám cho nhiều cảnh", () => {
    const a = img("a");
    const board = FootageBoard.empty().assign("s1", a).assign("s3", a).assign("s4", new FallbackFootage("fb"));
    const s = board.snapshot();
    expect(structuredClone(s)).toEqual(s);
    const back = FootageBoard.restore(structuredClone(s));
    expect(back.get("s1")?.id).toBe("a");
    expect(back.get("s3")?.id).toBe("a");
    expect(back.get("s2")).toBeUndefined();
    expect(back.get("s4")?.kind).toBe("fallback");
    expect(back.snapshot()).toEqual(s);
  });

  it("bảng rỗng round trip thành bảng rỗng", () => {
    expect(FootageBoard.restore(FootageBoard.empty().snapshot()).unassignedSceneIds(["s1"])).toEqual(["s1"]);
  });

  it("snapshot hỏng thì ném ValidationError", () => {
    expect(() => FootageBoard.restore({ assignments: [["s1", { kind: "gif", id: "x" } as never]] })).toThrow(ValidationError);
  });
});

describe("FootageBoard restore: dữ liệu hỏng không rõ kiểu", () => {
  const run = (v: unknown) => () => FootageBoard.restore(v as never);

  it("ném ValidationError thay vì TypeError", () => {
    expect(run(null)).toThrow(ValidationError);
    expect(run({})).toThrow(ValidationError);
    expect(run({ assignments: "x" })).toThrow(ValidationError);
    expect(run({ assignments: [null] })).toThrow(ValidationError);
    expect(run({ assignments: [[7, { kind: "fallback", id: "fb" }]] })).toThrow(ValidationError);
    expect(run({ assignments: [["s1", null]] })).toThrow(ValidationError);
  });
});
