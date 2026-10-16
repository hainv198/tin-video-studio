import { randomBytes } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";

export interface EnvChanges {
  set: Record<string, string>;
  clear: string[];
}

export interface EnvWriter {
  apply(changes: EnvChanges): Promise<void>;
}

const NAME = /^[A-Z][A-Z0-9_]*$/;

/** Ghi giá trị theo cách dotenv (Next.js) đọc lại đúng nguyên văn. */
function formatValue(value: string): string {
  if (/^[^\s#"'`\\$]+$/.test(value)) return value;
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes("`")) return `\`${value}\``;
  throw new Error("Giá trị chứa cả nháy đơn và dấu huyền, không ghi an toàn vào .env được");
}

/** Sửa .env.local tại chỗ: giữ nguyên dòng khác, comment, thứ tự và kiểu xuống dòng; ghi nguyên tử. */
export class EnvFileWriter implements EnvWriter {
  constructor(private readonly filePath: string) {}

  async apply(changes: EnvChanges): Promise<void> {
    const names = [...Object.keys(changes.set), ...changes.clear];
    for (const name of names) if (!NAME.test(name)) throw new Error("Tên biến không hợp lệ");

    const original = await this.read();
    const eol = original.includes("\r\n") ? "\r\n" : "\n";
    const endsWithEol = original === "" || original.endsWith("\n");
    const lines = original === "" ? [] : original.replace(/\r?\n$/, "").split(/\r?\n/);

    const ownsLine = (line: string, name: string) => new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`).test(line);
    let out = lines;
    for (const name of changes.clear) out = out.filter((line) => !ownsLine(line, name));
    for (const [name, value] of Object.entries(changes.set)) {
      const text = `${name}=${formatValue(value)}`;
      const first = out.findIndex((line) => ownsLine(line, name));
      if (first < 0) {
        out = [...out, text];
      } else {
        out = out.flatMap((line, i) => (i === first ? [text] : ownsLine(line, name) ? [] : [line]));
      }
    }

    const body = out.join(eol);
    const text = out.length === 0 ? "" : body + (endsWithEol ? eol : "");
    await this.writeAtomic(text);
  }

  private async read(): Promise<string> {
    try {
      return await readFile(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
      throw error;
    }
  }

  private async writeAtomic(text: string): Promise<void> {
    const tmp = `${this.filePath}.${randomBytes(6).toString("hex")}.tmp`;
    try {
      await writeFile(tmp, text, { encoding: "utf8", mode: 0o600 });
      await rename(tmp, this.filePath);
    } catch (error) {
      await unlink(tmp).catch(() => {});
      throw error;
    }
  }
}
