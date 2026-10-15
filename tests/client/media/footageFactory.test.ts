import { describe, expect, it } from "vitest";
import { parseUploadUri, stockItemToFootage, uploadToFootage, uploadUri } from "@/client/media/footageFactory";
import type { StockItemDto } from "@/client/services/StockClient";
import { ValidationError } from "@/domain/errors";

const base: StockItemDto = {
  provider: "pixabay",
  id: "pixabay-photo-9",
  kind: "image",
  thumbUrl: "https://t",
  fullUrl: "https://f.jpg",
  width: 1600,
  height: 900,
  author: "Cường",
  pageUrl: "https://p/9",
};

describe("stockItemToFootage", () => {
  it("ảnh thành ImageFootage mang nguồn, tác giả, trang gốc", () => {
    const f = stockItemToFootage(base, "f1");
    expect(f.snapshot()).toEqual({
      kind: "image",
      id: "f1",
      source: { origin: "pixabay", uri: "https://f.jpg", credit: "Cường", pageUrl: "https://p/9" },
      width: 1600,
      height: 900,
    });
  });

  it("video thành VideoFootage có độ dài; thiếu độ dài thì ném ValidationError", () => {
    const v = stockItemToFootage({ ...base, kind: "video", durationSec: 11.8 }, "f2");
    expect(v.snapshot()).toMatchObject({ kind: "video", durationSec: 11.8 });
    expect(() => stockItemToFootage({ ...base, kind: "video" }, "f3")).toThrow(ValidationError);
  });
});

describe("uploadToFootage", () => {
  it("ảnh tải lên dùng uri upload:<id>", () => {
    expect(uploadToFootage("f1", "upload-u1", "image", { width: 800, height: 600 }).snapshot()).toEqual({
      kind: "image",
      id: "f1",
      source: { origin: "upload", uri: "upload:upload-u1" },
      width: 800,
      height: 600,
    });
  });

  it("video tải lên cần độ dài", () => {
    expect(uploadToFootage("f2", "upload-u2", "video", { width: 1080, height: 1920, durationSec: 7 }).kind).toBe("video");
    expect(() => uploadToFootage("f2", "upload-u2", "video", { width: 1, height: 1 })).toThrow("Video thiếu độ dài");
  });
});

describe("uploadUri / parseUploadUri", () => {
  it("uploadUri ghép tiền tố upload:", () => {
    expect(uploadUri("upload-u1")).toBe("upload:upload-u1");
  });

  it("parseUploadUri trả id cho uri hợp lệ, null cho phần còn lại", () => {
    expect(parseUploadUri("upload:upload-u1")).toBe("upload-u1");
    expect(parseUploadUri(uploadUri("abc"))).toBe("abc");
    expect(parseUploadUri("upload:")).toBeNull();
    expect(parseUploadUri("https://f.jpg")).toBeNull();
    expect(parseUploadUri("")).toBeNull();
  });

  it("uploadToFootage ném ValidationError khi uploadId rỗng", () => {
    expect(() => uploadToFootage("f1", "", "image", { width: 1, height: 1 })).toThrow(ValidationError);
  });
});
