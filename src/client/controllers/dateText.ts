import { ValidationError } from "@/domain/errors";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** `yyyy-mm-dd` theo giờ địa phương, đúng định dạng của <input type="date">. */
export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromDateInput(text: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new ValidationError("Ngày đăng không hợp lệ");
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    throw new ValidationError("Ngày đăng không hợp lệ");
  }
  return date;
}
