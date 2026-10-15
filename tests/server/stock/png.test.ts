import { crc32, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { makeSolidPng } from "@/server/stock/png";

function chunks(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const out: Array<{ type: string; data: Uint8Array; crcOk: boolean }> = [];
  let offset = 8;
  while (offset < png.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const data = png.subarray(offset + 8, offset + 8 + length);
    const crc = view.getUint32(offset + 8 + length);
    out.push({ type, data, crcOk: crc === crc32(png.subarray(offset + 4, offset + 8 + length)) });
    offset += 12 + length;
  }
  return out;
}

describe("makeSolidPng", () => {
  const png = makeSolidPng(40, 20, [10, 200, 30]);

  it("có chữ ký PNG và các chunk IHDR, IDAT, IEND với CRC đúng", () => {
    expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const cs = chunks(png);
    expect(cs.map((c) => c.type)).toEqual(["IHDR", "IDAT", "IEND"]);
    expect(cs.every((c) => c.crcOk)).toBe(true);
  });

  it("IHDR ghi đúng kích thước, 8-bit RGB", () => {
    const ihdr = chunks(png)[0]?.data as Uint8Array;
    const view = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength);
    expect([view.getUint32(0), view.getUint32(4), ihdr[8], ihdr[9]]).toEqual([40, 20, 8, 2]);
  });

  it("dữ liệu ảnh giải nén ra đúng số byte và đúng màu điểm ảnh", () => {
    const raw = inflateSync(chunks(png)[1]?.data as Uint8Array);
    expect(raw.length).toBe(20 * (1 + 40 * 3));
    expect(Array.from(raw.subarray(0, 4))).toEqual([0, 10, 200, 30]); // bộ lọc 0 rồi điểm ảnh đầu
    expect(Array.from(raw.subarray(raw.length - 3))).toEqual([10, 200, 30]);
  });
});
