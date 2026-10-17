import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EnvFileWriter } from "@/server/config/EnvFileWriter";

let dir: string;
let file: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "envw-"));
  file = path.join(dir, ".env.local");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("EnvFileWriter", () => {
  it("tạo file mới khi chưa có", async () => {
    await new EnvFileWriter(file).apply({ set: { GEMINI_API_KEY: "abc" }, clear: [] });
    expect(await readFile(file, "utf8")).toBe("GEMINI_API_KEY=abc\n");
  });

  it("sửa tại chỗ, giữ nguyên dòng khác, comment và thứ tự", async () => {
    await writeFile(file, "# ghi chú\nAUTH_SECRET=xyz\nGEMINI_API_KEY=old\n\nAPP_USERS=[]\n");
    await new EnvFileWriter(file).apply({ set: { GEMINI_API_KEY: "new" }, clear: [] });
    expect(await readFile(file, "utf8")).toBe("# ghi chú\nAUTH_SECRET=xyz\nGEMINI_API_KEY=new\n\nAPP_USERS=[]\n");
  });

  it("giữ CRLF khi sửa và khi thêm cuối", async () => {
    await writeFile(file, "A=1\r\nGEMINI_API_KEY=old\r\nB=2\r\n");
    await new EnvFileWriter(file).apply({ set: { GEMINI_API_KEY: "new", PIXABAY_API_KEY: "pp" }, clear: [] });
    expect(await readFile(file, "utf8")).toBe("A=1\r\nGEMINI_API_KEY=new\r\nB=2\r\nPIXABAY_API_KEY=pp\r\n");
  });

  it("thêm cuối khi file không kết thúc bằng xuống dòng", async () => {
    await writeFile(file, "A=1");
    await new EnvFileWriter(file).apply({ set: { PEXELS_API_KEY: "k" }, clear: [] });
    expect(await readFile(file, "utf8")).toBe("A=1\nPEXELS_API_KEY=k");
  });

  it("xoá khoá (kể cả dòng trùng và tiền tố export), giữ phần còn lại", async () => {
    await writeFile(file, "A=1\nexport GEMINI_API_KEY=x\n# GEMINI_API_KEY=comment\nGEMINI_API_KEY=y\nB=2\n");
    await new EnvFileWriter(file).apply({ set: {}, clear: ["GEMINI_API_KEY"] });
    expect(await readFile(file, "utf8")).toBe("A=1\n# GEMINI_API_KEY=comment\nB=2\n");
  });

  it("không bắt nhầm khoá có tiền tố giống nhau", async () => {
    await writeFile(file, "GEMINI_API_KEY_OLD=1\n");
    await new EnvFileWriter(file).apply({ set: { GEMINI_API_KEY: "n" }, clear: [] });
    expect(await readFile(file, "utf8")).toBe("GEMINI_API_KEY_OLD=1\nGEMINI_API_KEY=n\n");
  });

  it("giá trị JSON được bọc ngoặc đơn để dotenv đọc nguyên văn", async () => {
    await new EnvFileWriter(file).apply({ set: { TEST_JSON_VALUE: '[{"alias":"A B"}]' }, clear: [] });
    expect(await readFile(file, "utf8")).toBe(`TEST_JSON_VALUE='[{"alias":"A B"}]'\n`);
  });

  it("không để lại file tạm", async () => {
    await new EnvFileWriter(file).apply({ set: { GEMINI_API_KEY: "a" }, clear: [] });
    expect(await readdir(dir)).toEqual([".env.local"]);
  });
});
