/**
 * Đọc bảng cmap của tệp TTF/OTF (định dạng 4 và 12, nền Unicode) để biết font có glyph cho ký tự nào.
 * Node thuần, không cần fonttools; dùng trong test kiểm font có đủ chữ tiếng Việt.
 */
export function cmapLookup(bytes: Uint8Array): (codepoint: number) => boolean {
  if (bytes.byteLength < 12) throw new Error("Font không có bảng cmap");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = view.getUint16(4);
  let cmap = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (rec + 16 > bytes.byteLength) break;
    const tag = String.fromCharCode(bytes[rec] ?? 0, bytes[rec + 1] ?? 0, bytes[rec + 2] ?? 0, bytes[rec + 3] ?? 0);
    if (tag === "cmap") {
      cmap = view.getUint32(rec + 8);
      break;
    }
  }
  if (cmap < 0) throw new Error("Font không có bảng cmap");

  const count = view.getUint16(cmap + 2);
  let format4 = -1;
  let format12 = -1;
  for (let i = 0; i < count; i++) {
    const rec = cmap + 4 + i * 8;
    const platform = view.getUint16(rec);
    const encoding = view.getUint16(rec + 2);
    const offset = cmap + view.getUint32(rec + 4);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    const format = view.getUint16(offset);
    if (format === 12) format12 = offset;
    else if (format === 4) format4 = offset;
  }

  if (format12 >= 0) {
    const groups = view.getUint32(format12 + 12);
    return (cp) => {
      for (let g = 0; g < groups; g++) {
        const r = format12 + 16 + g * 12;
        const start = view.getUint32(r);
        const end = view.getUint32(r + 4);
        if (cp >= start && cp <= end) return view.getUint32(r + 8) + (cp - start) !== 0;
      }
      return false;
    };
  }

  if (format4 >= 0) {
    const segX2 = view.getUint16(format4 + 6);
    const ends = format4 + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    return (cp) => {
      if (cp > 0xffff) return false;
      for (let s = 0; s < segX2; s += 2) {
        if (cp > view.getUint16(ends + s)) continue;
        const start = view.getUint16(starts + s);
        if (cp < start) return false;
        const delta = view.getInt16(deltas + s);
        const rangeOffset = view.getUint16(ranges + s);
        if (rangeOffset === 0) return ((cp + delta) & 0xffff) !== 0;
        const glyph = view.getUint16(ranges + s + rangeOffset + 2 * (cp - start));
        return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0;
      }
      return false;
    };
  }

  throw new Error("Font không có bảng cmap Unicode định dạng 4 hoặc 12");
}

/** Các mã ký tự (bỏ trùng, giữ thứ tự xuất hiện) mà font không có glyph. */
export function missingCodepoints(bytes: Uint8Array, text: string): number[] {
  const has = cmapLookup(bytes);
  const codepoints = [...new Set([...text].map((c) => c.codePointAt(0) as number))];
  return codepoints.filter((cp) => !has(cp));
}
