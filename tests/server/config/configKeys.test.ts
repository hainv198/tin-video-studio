import { describe, expect, it } from "vitest";
import { ValidationError } from "@/domain/errors";
import { assertValidValue, type ConfigKeyDef } from "@/server/config/configKeys";

const jsonDef: ConfigKeyDef = { key: "TEST_JSON", label: "t", hint: "t", kind: "json" };
const flagDef: ConfigKeyDef = { key: "TEST_FLAG", label: "t", hint: "t", kind: "flag" };

describe("assertValidValue", () => {
  it("kiểu json: nhận mảng, từ chối JSON hỏng hoặc không phải mảng", () => {
    expect(() => assertValidValue(jsonDef, '[{"a":1}]')).not.toThrow();
    expect(() => assertValidValue(jsonDef, "{khong-json")).toThrow(ValidationError);
    expect(() => assertValidValue(jsonDef, '{"a":1}')).toThrow(ValidationError);
  });

  it("kiểu flag: chỉ nhận 1", () => {
    expect(() => assertValidValue(flagDef, "1")).not.toThrow();
    expect(() => assertValidValue(flagDef, "yes")).toThrow(ValidationError);
  });

  it("thông báo lỗi không chứa giá trị", () => {
    expect(() => assertValidValue(jsonDef, "BIMAT-json{")).toThrow(/^(?!.*BIMAT)/);
  });
});
