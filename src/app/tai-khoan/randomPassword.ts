/** Bỏ các ký tự dễ nhầm (I, l, O, 0, 1) để admin đọc/gửi cho người dùng không sai. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

type Fill = (array: Uint8Array<ArrayBuffer>) => Uint8Array;

/** Sinh mật khẩu phía trình duyệt bằng crypto.getRandomValues; loại byte lệch để phân bố đều. */
export function randomPassword(length = 14, fill: Fill = (a) => crypto.getRandomValues(a)): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < length) {
    const bytes = fill(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (b < limit) out += ALPHABET[b % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}
